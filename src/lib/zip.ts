/**
 * Bundles generated files into a single archive.
 *
 * Kept in its own module so JSZip is only fetched when the user actually asks
 * for a ZIP — it is the heaviest dependency in the app.
 */

export { zipArtifacts } from './files'
