export type SkillOrigin = "repo" | "global";

export type SkillIndexEntry = {
  name: string;
  description?: string;
  origin: SkillOrigin;
  path: string;
};

export type SkillIndex = {
  roots: {
    repo?: string;
    global?: string;
  };
  skills: SkillIndexEntry[];
};

