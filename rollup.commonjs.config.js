import commonjs from '@rollup/plugin-commonjs';
import babel from 'rollup-plugin-babel';
import json from '@rollup/plugin-json';
import builtins from 'builtin-modules';
import replace from "@rollup/plugin-replace";

export default {
    input: 'src/main.commonjs.mjs',
    output: {
        file: 'commonjs/index.js',
        format: 'cjs'
    },
    plugins: [
        replace({
            include: ['src/**'],
            delimiters: ['', ''],
            values: {
                "'@fanoutio/pubcontrol'": "'@fanoutio/pubcontrol/commonjs'",
                "'@fanoutio/grip'": "'@fanoutio/grip/commonjs'",
            },
        }),
        commonjs(),
        json(),
        babel({
            babelrc: false,
            exclude: 'node_modules/**',　// only transpile our source code
            plugins: [
                '@babel/plugin-proposal-class-properties',
                '@babel/plugin-proposal-nullish-coalescing-operator',
                '@babel/plugin-proposal-optional-chaining',
            ],
        }),
    ],
    external: [
        ...builtins,
        'jspack',
        '@fanoutio/pubcontrol/commonjs',
        '@fanoutio/grip/commonjs',
    ],
};
