import type { GeneratedResume, JobAnalysis, ResumeExperienceInput, ResumeProfile, SupplementResult } from "@/lib/resume-types";

async function callDeepseekJson<T>(system: string, prompt: string): Promise<T> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY 未配置");
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
      temperature: 0.15,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
    }),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 240);
    throw new Error(`DeepSeek 请求失败（${response.status}）${detail ? `：${detail}` : ""}`);
  }
  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const raw = data.choices?.[0]?.message?.content?.trim();
  if (!raw) throw new Error("DeepSeek 没有返回内容");
  const json = raw.replace(/^```json\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(json) as T;
}

export async function analyseJobDescriptions(role: string, mainJD: string, references: string[]): Promise<JobAnalysis> {
  const prompt = `请分析目标岗位的主JD与参考JD，输出细致、可用于筛选简历经历的岗位画像。

严格要求：
1. 主JD是最高优先级；参考JD只用于补充同类岗位的共性要求。
2. 必须区分 main_jd_keywords、reference_jd_keywords、common_keywords，不能把参考JD词语标成主JD词语。
3. 关键词不能只写“沟通”“运营”“数据分析”等宽泛词。优先输出“使用SQL进行多业务线数据清洗”“建立指标监控体系”“从用户研究到MVP落地”等具体能力短语。
4. evidence 必须引用JD里的简短原句或可靠概括；禁止引入JD之外的岗位信息。
5. 每组关键词6-12项；没有参考JD时 reference_jd_keywords 和 common_keywords 返回空数组。

只输出JSON：
{"role_summary":"","main_jd_keywords":[{"keyword":"","source":"主JD","importance":"高|中|低","evidence":""}],"reference_jd_keywords":[{"keyword":"","source":"参考JD","importance":"高|中|低","evidence":""}],"common_keywords":[{"keyword":"","source":"主JD+参考JD","importance":"高|中|低","evidence":""}],"responsibilities":[],"tools_and_methods":[],"domain_terms":[],"candidate_requirements":[]}

目标岗位：${role}
主JD：${mainJD}
参考JD（${references.length}份）：${JSON.stringify(references)}`;
  const result = await callDeepseekJson<JobAnalysis>("你是严谨的招聘需求分析师。只基于提供的JD，不联网，不补充外部事实。", prompt);
  for (const key of ["main_jd_keywords", "reference_jd_keywords", "common_keywords", "responsibilities", "tools_and_methods", "domain_terms", "candidate_requirements"] as const) {
    if (!Array.isArray(result[key])) throw new Error(`岗位分析缺少字段：${key}`);
  }
  return result;
}

export async function createSupplementAdvice(analysis: JobAnalysis, experiences: ResumeExperienceInput[]): Promise<SupplementResult> {
  const buildPrompt = (items: ResumeExperienceInput[], retry = false) => `任务：基于目标岗位视角，按 STAR 法则重写简历要点（Bullets）。

核心原则：事实锁定，视角切换。
- 事实锁（不可变）：原文明确写出的动作、工具/技术栈、具体数字、职责级别（参与/协助/负责/主导）不可添加、篡改、强化或推断。
- 视角窗（可优化）：可根据目标岗位 JD 的能力要求，重新聚焦原文已经支持的业务痛点、任务目标和成果价值方向；不得引入原文完全没有的新场景。

STAR 法则（必须遵循）：
- S（Situation）：工作背景、项目规模、团队情况、业务痛点等客观环境。
- T（Task）：用户承担的具体任务、职责或要解决的核心问题。
- A（Action）：用户采取的行动、使用的方法、工具或技术。
- R（Result）：行动带来的量化或定性成果、产出、影响。

执行规则：
1. 每段经历都必须返回一条 advice，experience_id 必须保持原值。
2. 先提取原文中的硬事实，再解析 JD 的核心能力视角；fit_reason 和 matched_requirements 必须引用具体 JD 条目，并说明从哪个岗位视角重组了已有的 S/T。
3. 逐段检查 S、T、A、R 是否齐全。每个缺失或表述模糊的要素，都必须写入 missing_or_weak_points：S 缺背景/规模/痛点，T 缺职责/目标，A 缺具体方法/工具，R 缺真实结果/产出或结果含义不清。
4. 建议必须具体到原文位置，例如“第二条工作内容只写了搭建看板，没有说明看板服务的业务方或决策用途”，不得笼统写“缺少 STAR”或“建议量化”。
5. jd_reason 必须点明该问题与哪一条具体 JD 要求有关。question 用于向用户询问真实信息；禁止自行编造数字、成果、工具、职责、用户反馈或项目背景。
6. 不要输出经历总起、概述段或 suggested_summary 字段。所有可写入简历的事实只能放在 suggested_bullets 中。
7. suggested_bullets 必须提供 2-4 条，并合力讲清一个完整 STAR 故事：第 1 条优先说明已有事实支持的背景（S）和任务（T）；后续条目集中写行动（A）和结果（R）。每条均应包含明确动作和真实结果/产出。
8. 每条 bullet 只表达一个独立事实或动作链，不得先概括全部工作、再在后续重复展开；不同 bullet 不得重复同一行动、工具、成果或背景。
9. 可以把原文隐含但逻辑直接支持的动作目的，用 JD 视角表达得更清楚；不得推断用户数量、上线效果、团队规模或未写明的业务场景。
10. 数字必须原样保留，原文无数字时只能保留定性描述；工具、技术栈和职责级别均不得新增或强化。例如“参与”不能改为“主导”，“完成测试版交付”不能改为“独立完成开发”。
11. changes_made 必须逐条说明视角如何调整、STAR 如何重新排布，例如“以 JD 关注的业务痛点重组已有背景（S）”“将原文中的任务目标前置（T）”“把已有工具和动作合并为 A/R 要点”。不得只写“优化表达”。
${retry ? "12. 上一次结果与原文没有明显差异。本次必须使用不同句式和信息顺序，不能照抄原句，但仍须遵守事实锁。" : ""}

只输出JSON：
{"overall_note":"","advice":[{"experience_id":0,"fit_reason":"","matched_requirements":[],"missing_or_weak_points":[{"location":"","problem":"","jd_reason":"","question":""}],"suggested_bullets":[],"changes_made":[]}]}

岗位画像：${JSON.stringify(analysis)}
已选择经历：${JSON.stringify(items)}`;

  const normalize = (value: string) => value.replace(/[\s，。；：、,.!?！？·•—\-｜|（）()“”"']/g, "").toLowerCase();
  const clean = (result: SupplementResult) => {
    if (!Array.isArray(result.advice)) throw new Error("补充建议结构不完整");
    return {
      ...result,
      advice: result.advice.map((item) => ({
        ...item,
        experience_id: Number(item.experience_id),
        matched_requirements: Array.isArray(item.matched_requirements) ? item.matched_requirements.filter(Boolean) : [],
        missing_or_weak_points: Array.isArray(item.missing_or_weak_points) ? item.missing_or_weak_points : [],
        suggested_bullets: Array.isArray(item.suggested_bullets) ? item.suggested_bullets.map((value) => value.trim()).filter(Boolean) : [],
        changes_made: Array.isArray(item.changes_made) ? item.changes_made.map((value) => value.trim()).filter(Boolean) : [],
      })),
    };
  };
  const needsRewrite = (item: ResumeExperienceInput, advice?: SupplementResult["advice"][number]) => {
    if (!advice || advice.suggested_bullets.length < 2 || !advice.changes_made.length) return true;
    const originalLines = [item.summary, ...(item.evidence ?? [])].map(normalize).filter(Boolean);
    const copiedBullets = advice.suggested_bullets.every((bullet) => originalLines.includes(normalize(bullet)));
    return copiedBullets;
  };

  let result = clean(await callDeepseekJson<SupplementResult>("你是求职简历诊断与改写顾问。用 STAR 框架诊断并重组经历；绝不编造用户没有提供的事实或数字；修改稿必须与原文可区分。", buildPrompt(experiences)));
  const retryItems = experiences.filter((item) => needsRewrite(item, result.advice.find((advice) => advice.experience_id === item.id)));
  if (retryItems.length) {
    const retryResult = clean(await callDeepseekJson<SupplementResult>("你是求职简历改写顾问。保留全部事实，按 STAR 重新组织句式和信息顺序，不能原样返回输入。", buildPrompt(retryItems, true)));
    const retryById = new Map(retryResult.advice.map((item) => [item.experience_id, item]));
    result = { ...result, advice: result.advice.map((item) => retryById.get(item.experience_id) ?? item) };
  }
  for (const experience of experiences) {
    const advice = result.advice.find((item) => item.experience_id === experience.id);
    if (needsRewrite(experience, advice)) throw new Error(`AI没有为“${experience.title}”生成可区分的修改稿，请重新生成建议`);
  }
  return result;
}

export async function generateTailoredResume(
  role: string,
  language: string,
  analysis: JobAnalysis,
  experiences: ResumeExperienceInput[],
  profile?: Pick<ResumeProfile, "name" | "educations">,
): Promise<GeneratedResume> {
  const isEnglish = language === "英文";
  const prompt = `请根据岗位画像和用户确认后的真实经历，生成一页简历的核心内容。

严格要求：
1. 只能使用输入经历中的事实，禁止新增数字、成果、工具、职责或项目背景。
2. reviewMode 为 ai 或 manual 时，summary 是用户在第四步确认的修改稿，必须以该版本为准，不得退回 originalSummary；将其整理为2-4条 resumeBullets。
3. reviewMode 为 original 时，用户明确要求保持原文：中文版本不得改写、替换或补充其措辞；英文版本只能忠实翻译原文，不得借翻译之名补充、删减或强化事实。
4. resumeBullets 使用“行动+方法+结果/产出”的结构，但事实不完整时不要伪造结果。
5. 优先使用与JD高度相关的事实和关键词，自然融入，禁止关键词堆砌。
6. experiences 必须按 period 中的最近结束时间从近到远排列；无法识别时间的放最后。
7. 保留每段经历的 id/title/org/period/type/summary/tags/evidence。
8. skills 必须返回空数组。专业技能和资格证书由用户自己的简历资料提供，AI不得筛选、增加或删除。
9. 不要生成求职方向标题、个人简介、职业概述、自我评价或任何复述 JD 的模块。最终简历只应包含个人信息、教育经历、分类经历和个人技能；这些固定区块由页面模板负责。
10. 输出语言：${language}。${isEnglish ? "所有面向招聘者的字段（title、resumeSummary、resumeBullets、matchReason）必须为自然、专业的英文；公司、产品等专有名称如无可靠英文名可保留原文。type 必须保留原始中文分类值，供模板映射英文标题。" : "所有面向招聘者的字段使用自然、专业的中文。"}
11. ${isEnglish ? "必须返回 profile_translation：english_name 为用户中文姓名对应的全大写汉语拼音（例如“王小明”→“WANG XIAOMING”）；educations 中每条 id 必须对应输入简历资料中的同一 id，school 与 major 必须翻译为规范、自然的英文。优先采用学校常用官方英文名；无法确认时以忠实音译或直译表达，不能保留中文。不得编造学位、院系、排名、年份或其他未提供信息。" : "profile_translation 返回 null。"}

只输出JSON：
{"skills":[],"generation_note":"","profile_translation":${isEnglish ? '{"english_name":"","educations":[{"id":"","school":"","major":""}]}' : "null"},"experiences":[{"id":0,"title":"","org":"","period":"","type":"","summary":"","tags":[],"evidence":[],"resumeSummary":"","resumeBullets":[],"matchReason":""}]}

目标岗位：${role}
岗位画像：${JSON.stringify(analysis)}
用户确认后的经历：${JSON.stringify(experiences)}
简历资料（仅用于姓名和教育经历本地化）：${JSON.stringify(profile ? { name: profile.name, educations: profile.educations.map((education) => ({ id: education.id, school: education.school, major: education.major })) } : { name: "", educations: [] })}`;
  const result = await callDeepseekJson<GeneratedResume>(isEnglish ? "You are a meticulous English resume writer. Faithfulness to the supplied facts is more important than style. Never invent facts, metrics, tools, scope, or seniority." : "你是严谨的中文简历撰写顾问。真实性高于文采，绝不虚构。", prompt);
  if (!Array.isArray(result.experiences) || !Array.isArray(result.skills)) throw new Error("简历生成结果结构不完整");
  if (isEnglish && profile) {
    const translation = result.profile_translation;
    const translatedById = new Map((translation?.educations ?? []).map((education) => [education.id, education]));
    if (profile.name.trim() && !translation?.english_name?.trim()) throw new Error("AI未返回英文姓名，请重新生成英文简历");
    for (const education of profile.educations) {
      const translated = translatedById.get(education.id);
      if ((education.school.trim() && !translated?.school?.trim()) || (education.major.trim() && !translated?.major?.trim())) throw new Error("AI未完整返回学校或专业的英文名称，请重新生成英文简历");
    }
  }
  return result;
}
