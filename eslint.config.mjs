import { FlatCompat } from '@eslint/eslintrc';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'public/**',
      'test/fixtures/**',
      'src/types/generated/**',
      'src/lib/validators/generated/**',
      'next-env.d.ts',
      'test-results/**',
      'playwright-report/**',
      '.lighthouseci/**',
    ],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript', 'prettier'),
];

export default config;
