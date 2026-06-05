export default [
  {
    name: 'replace-process-env',
    transform(code) {
      return code.replace(/process\.env\.NODE_ENV/g, '"production"');
    },
  },
];
