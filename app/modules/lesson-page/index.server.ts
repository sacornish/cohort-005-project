// The lesson page's server side: which capability each form intent needs,
// what the page loads, and what each intent does once permission is granted.
export { lessonRef, parseLessonId, INTENT_CAPABILITY } from "./lib/ref";
export { loadLessonPage } from "./lib/load";
export { runLessonIntent } from "./lib/intents";
