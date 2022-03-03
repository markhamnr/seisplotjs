module.exports = {
    "extends": [
      "eslint:recommended",
      "plugin:jest/recommended",
      "plugin:jsdoc/recommended"
    ],
    "parser": "@babel/eslint-parser",
    "plugins": [
      "promise",
      "jest",
      "jsdoc"
    ],
    "env": {
      "es6": true,
      "browser": true,
      "jest/globals": true
    },
    "parserOptions": {
        "ecmaVersion": 6,
        "sourceType": "module",
    },
    "rules": {
      "semi": ["error", "always"],
      "no-var": ["error"],
      "no-console": [ "error"],
      "no-unused-vars": [ "error"],
      "eqeqeq": ["error", "always"],
      "jsdoc/require-param-type": ["off"],
      "jsdoc/require-returns-type": ["off"],
      "jsdoc/no-types": ["error"],
      "jsdoc/require-jsdoc": ["off", {"require":{"MethodDefinition":true}}]
    }
};
