export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // The specification accepts either ! or a BREAKING CHANGE footer.
    'breaking-change-exclamation-mark': [0],
    'subject-case': [0],
  },
};
