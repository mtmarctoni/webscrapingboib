/** @type {import('dependency-cruiser').ICruiseOptions} */
module.exports = {
  forbidden: [
    {
      name: "domain-must-not-import-infrastructure-or-application",
      comment:
        "Domain layer must be pure: no I/O, no application concerns",
      severity: "error",
      from: { path: "^src/domain/" },
      to: { path: "^(src/infrastructure/|src/application/)" },
    },
    {
      name: "infrastructure-must-not-import-application",
      comment: "Infrastructure must not depend on application layer",
      severity: "error",
      from: { path: "^src/infrastructure/" },
      to: { path: "^src/application/" },
    },
    {
      name: "no-circular-dependencies",
      comment: "Circular dependencies increase maintenance cost",
      severity: "warn",
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: {
      path: "node_modules",
    },
    tsConfig: {
      fileName: "tsconfig.json",
    },
  },
};
