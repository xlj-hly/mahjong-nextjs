/** @type {import('@commitlint/types').UserConfig} */
const commitlintConfig = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'subject-case': [0],
    'body-max-line-length': [0],
    'footer-max-line-length': [0],
  },
}

export default commitlintConfig
