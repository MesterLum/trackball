const major = Number(process.versions.node.split('.')[0]);
if (major !== 24) {
  console.error(
    `Use Node.js 24 LTS (currently ${process.version}). Run nix develop, or use the version in .node-version.`,
  );
  process.exit(1);
}
console.log(`Node.js ${process.version}`);
