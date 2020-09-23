module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: ['./tsconfig.json'],
  },
  rules: {
    '@typescript-eslint/ban-types': 0,
    'no-console': 0,
    'promise/catch-or-return': 0,
    'promise/always-return': 0,
    '@typescript-eslint/no-use-before-define': 0,
    'no-underscore-dangle': 0,
    '@typescript-eslint/no-explicit-any': 0,
    'quotes': [1, 'single'],
    'no-irregular-whitespace': 1,
    'no-trailing-spaces': 1
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'airbnb-typescript',
    'plugin:@typescript-eslint/recommended',
    'plugin:eslint-comments/recommended',
    'plugin:promise/recommended',
    'prettier',
    'prettier/@typescript-eslint',
  ],
};
