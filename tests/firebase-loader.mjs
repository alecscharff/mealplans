// Exercise the production storage module with the identical SDK version in Node.
export async function resolve(specifier, context, nextResolve) {
  const match = specifier.match(/^https:\/\/www\.gstatic\.com\/firebasejs\/10\.14\.1\/firebase-(app|auth|firestore)\.js$/);
  return nextResolve(match ? `firebase/${match[1]}` : specifier, context);
}
