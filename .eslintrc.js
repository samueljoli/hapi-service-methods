module.exports = {
    env: {
        es6: true,
        node: true
    },
    globals: {
        Atomics: 'readonly',
        SharedArrayBuffer: 'readonly',
    },
    parserOptions: {
        "ecmaVersion": 2018,
    },
    extends: [
        "eslint:recommended",
        "airbnb-base",
    ],
    rules: {
        "indent": ["error", 4],
        "no-console": 0,
        "consistent-return": 0,
        "global-require": 0,
        "import/no-dynamic-require": 0,
        "import/prefer-default-export": 0,
        "max-len": 2,
        "no-param-reassign": 0,
        "no-underscore-dangle": 0,
        "no-use-before-define": 2,
        "no-useless-concat": 0,
        "strict": 0,
        "no-multi-assign": 0,
        "padded-blocks": 0
    },
};
