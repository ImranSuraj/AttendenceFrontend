import { postForm } from "./postForm";

// CalendarPatternsController (api/admin/calendar-patterns): the raw upload response, read by the service.
export const upload = (form) => postForm("/admin/calendar-patterns", form);