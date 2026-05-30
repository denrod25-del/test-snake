export type CalloutTone = "tip" | "warn";

export type DrillBlank = { blank: string; accept?: string[] };

export type LessonBlock =
  | { type: "text"; html: string }
  | { type: "callout"; tone: CalloutTone; label: string; html: string }
  | {
      type: "quiz";
      q: string;
      options: string[];
      answer: number;
      why: string;
    }
  | { type: "reading"; title: string; href: string; note?: string }
  | { type: "drill-fill"; parts: Array<string | DrillBlank> }
  | {
      type: "drill-reorder";
      intro?: string;
      lines: string[];
      /** Line indices top-to-bottom: e.g. [2,0,1] shows lines[2] first. */
      correctOrder: number[];
    };

export type Lesson = {
  id: string;
  title: string;
  description?: string;
  blocks: LessonBlock[];
};

export type CourseModule = {
  id: string;
  title: string;
  description: string;
  icon: string;
  accentClass: string;
  lessons: Lesson[];
};
