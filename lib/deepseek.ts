export async function analyseExperience(chunks: Array<{ id: string; content: string }>) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY 未配置");
  if (!chunks.length) throw new Error("文档中没有提取到可整理的文字");
  const prompt = `任务：把下面这一次上传的求职材料整理为可追溯的职业经历。

严格规则：
1. 只能使用「原始材料」中的事实，禁止使用示例、常识或模板补全。
2. 不确定的信息填空字符串，并放进 questions_for_user；禁止猜日期、公司、职位、数字或成果。
3. 必须覆盖原文中每一段可用于求职的不同经历；不要把不同公司或项目合并。
4. structured_summary 只做书面化和结构化，不改变事实；evidence_points 应具体保留“做了什么、如何做、结果/产出”。
5. source_chunk_ids 只能引用原始材料中真实存在的 id。每个事实必须有来源 id。
6. 每段经历必须且只能分类为：工作经历、实习经历、项目经历、校园经历。竞赛、科研、个人项目统一归入项目经历；学生组织、社团和校内职务归入校园经历。
7. 项目经历和校园经历可以没有机构；原文未说明机构时 organization_name.value 必须返回空字符串，禁止输出“机构待确认”等占位字样。
8. 不要输出任何与本材料无关的职业经历。

只输出以下结构的 JSON：
{"document_analysis":{"document_type":"","risk_flags":[]},"experience_candidates":[{"experience_type":"工作经历|实习经历|项目经历|校园经历","organization_name":{"value":"","source_chunk_ids":[],"confidence":"high|medium|low"},"title":{"value":"","source_chunk_ids":[],"confidence":"high|medium|low"},"start_date":{"value":"","source_chunk_ids":[],"confidence":"high|medium|low"},"end_date":{"value":"","source_chunk_ids":[],"confidence":"high|medium|low"},"structured_summary":"","evidence_points":[{"category":"","content":"","skills":[],"tags":[],"source_chunk_ids":[],"confidence":"high|medium|low"}]}],"merge_plan":[],"questions_for_user":[]}

<原始材料>
${JSON.stringify(chunks)}
</原始材料>`;
  const response = await fetch("https://api.deepseek.com/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model: "deepseek-v4-flash", temperature: 0.1, response_format: { type: "json_object" }, messages: [{ role: "system", content: "你是严谨的中文职业经历档案员。你只能抽取用户本次提供的原文事实，并输出有效 JSON。" }, { role: "user", content: prompt }] }) });
  if (!response.ok) throw new Error(`DeepSeek 请求失败：${response.status}`);
  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("DeepSeek 没有返回整理内容");
  const result = JSON.parse(content) as { experience_candidates?: unknown[] };
  if (!Array.isArray(result.experience_candidates)) throw new Error("DeepSeek 返回的数据结构不完整");
  return result;
}
