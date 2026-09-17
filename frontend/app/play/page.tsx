/**
 * A real route so /play can be linked to, refreshed and crawled.
 *
 * It renders the same app as "/": which screen shows is decided from the path by
 * useRoutedView, so navigating between them never unmounts a round in progress.
 */
export { default } from "../page";
