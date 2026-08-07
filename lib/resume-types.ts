export type ResumeExperienceInput = {
  id: number;
  title: string;
  org: string;
  period: string;
  type: string;
  summary: string;
  tags: string[];
  evidence?: string[];
  reviewMode?: "ai" | "manual" | "original";
  originalSummary?: string;
};

export type ResumeEducation = {
  id: string;
  school: string;
  major: string;
  startYear: string;
  endYear: string;
};

export type ResumeProfile = {
  name: string;
  phone: string;
  email: string;
  educations: ResumeEducation[];
  professionalSkills: string[];
  certificates: string[];
};

export type EnglishProfileTranslation = {
  english_name: string;
  educations: Array<{ id: string; school: string; major: string }>;
};

export type KeywordItem = {
  keyword: string;
  source: "主JD" | "参考JD" | "主JD+参考JD";
  importance: "高" | "中" | "低";
  evidence: string;
};

export type JobAnalysis = {
  role_summary: string;
  main_jd_keywords: KeywordItem[];
  reference_jd_keywords: KeywordItem[];
  common_keywords: KeywordItem[];
  responsibilities: string[];
  tools_and_methods: string[];
  domain_terms: string[];
  candidate_requirements: string[];
};

export type ExperienceAdvice = {
  experience_id: number;
  fit_reason: string;
  matched_requirements: string[];
  missing_or_weak_points: Array<{
    location: string;
    problem: string;
    jd_reason: string;
    question: string;
  }>; 
  suggested_bullets: string[];
  changes_made: string[];
};

export type SupplementResult = {
  overall_note: string;
  advice: ExperienceAdvice[];
};

export type GeneratedExperience = ResumeExperienceInput & {
  resumeSummary: string;
  resumeBullets: string[];
  matchReason?: string;
};

export type GeneratedResume = {
  skills: string[];
  generation_note: string;
  experiences: GeneratedExperience[];
  profile_translation?: EnglishProfileTranslation;
};

export type ResumeDraft = GeneratedResume & {
  id?: string;
  title: string;
  language: string;
  createdAt: string;
  company?: string;
  role?: string;
  mainJD?: string;
  references?: string[];
  requiredIds?: number[];
  analysis?: JobAnalysis;
  resumeProfile?: ResumeProfile;
  certificates?: string[];
};
