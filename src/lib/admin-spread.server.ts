/**
 * Conservé pour les appelants historiques : la vérification du rôle vit
 * désormais dans editor-context.server.ts, seul fabricant d'un EditorContext.
 */
export { assertEditor, type EditorContext } from "./editor-context.server";
