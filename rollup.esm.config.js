import commonjs from '@rollup/plugin-commonjs';
import babel from 'rollup-plugin-babel';
import json from '@rollup/plugin-json';
import builtins from 'builtin-modules';

export default {
    input: 'src/main.mjs',
    output: {
        file: 'esm/main.mjs',
        format: 'esm'
    },
    plugins: [
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
        '@fanoutio/pubcontrol',
        '@fanoutio/grip',
    ],
};
