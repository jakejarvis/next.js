import fs from 'fs-extra'
import os from 'os'
import execa from 'execa'

import { dirname, join } from 'path'

import findUp from 'next/dist/compiled/find-up'
import { nextBuild, nextLint } from 'next-test-utils'

const dirFirstTimeSetup = join(__dirname, '../first-time-setup')
const dirCustomConfig = join(__dirname, '../custom-config')
const dirWebVitalsConfig = join(__dirname, '../config-core-web-vitals')
const dirPluginRecommendedConfig = join(
  __dirname,
  '../plugin-recommended-config'
)
const dirPluginCoreWebVitalsConfig = join(
  __dirname,
  '../plugin-core-web-vitals-config'
)
const dirIgnoreDuringBuilds = join(__dirname, '../ignore-during-builds')
const dirCustomDirectories = join(__dirname, '../custom-directories')
const dirConfigInPackageJson = join(__dirname, '../config-in-package-json')
const dirInvalidOlderEslintVersion = join(
  __dirname,
  '../invalid-eslint-version'
)
const dirMaxWarnings = join(__dirname, '../max-warnings')
const dirEmptyDirectory = join(__dirname, '../empty-directory')
const dirEslintIgnore = join(__dirname, '../eslint-ignore')
const dirNoEslintPlugin = join(__dirname, '../no-eslint-plugin')
const dirNoConfig = join(__dirname, '../no-config')
const dirEslintCache = join(__dirname, '../eslint-cache')
const dirEslintCacheCustomDir = join(__dirname, '../eslint-cache-custom-dir')
const dirFileLinting = join(__dirname, '../file-linting')

describe('ESLint', () => {
  describe('Next Build', () => {
    test('first time setup', async () => {
      const eslintrcJson = join(dirFirstTimeSetup, '.eslintrc.json')
      await fs.writeFile(eslintrcJson, '')

      const { stdout, stderr } = await nextBuild(dirFirstTimeSetup, [], {
        stdout: true,
        stderr: true,
      })
      const output = stdout + stderr

      expect(output).toContain(
        'No ESLint configuration detected. Run next lint to begin setup'
      )
    })

    test('shows warnings and errors', async () => {
      const { stdout, stderr } = await nextBuild(dirCustomConfig, [], {
        stdout: true,
        stderr: true,
      })

      const output = stdout + stderr
      expect(output).toContain(
        'Warning: External synchronous scripts are forbidden'
      )
      expect(output).toContain(
        'Error: Comments inside children section of tag should be placed inside braces'
      )
    })

    test('ignore during builds', async () => {
      const { stdout, stderr } = await nextBuild(dirIgnoreDuringBuilds, [], {
        stdout: true,
        stderr: true,
      })

      const output = stdout + stderr
      expect(output).not.toContain('Failed to compile')
      expect(output).not.toContain(
        'Error: Comments inside children section of tag should be placed inside braces'
      )
    })

    test('custom directories', async () => {
      const { stdout, stderr } = await nextBuild(dirCustomDirectories, [], {
        stdout: true,
        stderr: true,
      })

      const output = stdout + stderr
      expect(output).toContain('Failed to compile')
      expect(output).toContain(
        'Error: Comments inside children section of tag should be placed inside braces'
      )
      expect(output).toContain(
        'Warning: External synchronous scripts are forbidden'
      )
    })

    test('invalid older eslint version', async () => {
      const { stdout, stderr } = await nextBuild(
        dirInvalidOlderEslintVersion,
        [],
        {
          stdout: true,
          stderr: true,
        }
      )

      const output = stdout + stderr
      expect(output).toContain(
        'Your project has an older version of ESLint installed'
      )
    })

    test('empty directories do not fail the build', async () => {
      const { stdout, stderr } = await nextBuild(dirEmptyDirectory, [], {
        stdout: true,
        stderr: true,
      })

      const output = stdout + stderr
      expect(output).not.toContain('Build error occurred')
      expect(output).not.toContain('NoFilesFoundError')
      expect(output).toContain(
        'Warning: External synchronous scripts are forbidden'
      )
      expect(output).toContain('Compiled successfully')
    })

    test('eslint ignored directories do not fail the build', async () => {
      const { stdout, stderr } = await nextBuild(dirEslintIgnore, [], {
        stdout: true,
        stderr: true,
      })

      const output = stdout + stderr
      expect(output).not.toContain('Build error occurred')
      expect(output).not.toContain('AllFilesIgnoredError')
      expect(output).toContain(
        'Warning: External synchronous scripts are forbidden'
      )
      expect(output).toContain('Compiled successfully')
    })

    test('missing Next.js plugin', async () => {
      const { stdout, stderr } = await nextBuild(dirNoEslintPlugin, [], {
        stdout: true,
        stderr: true,
      })

      const output = stdout + stderr
      expect(output).toContain(
        'The Next.js plugin was not detected in your ESLint configuration'
      )
    })

    test('eslint caching is enabled', async () => {
      const cacheDir = join(dirEslintCache, '.next', 'cache')

      await fs.remove(cacheDir)
      await nextBuild(dirEslintCache, [])

      const files = await fs.readdir(join(cacheDir, 'eslint/'))
      const cacheExists = files.some((f) => /\.cache/.test(f))

      expect(cacheExists).toBe(true)
    })

    test('eslint cache lives in the user defined build directory', async () => {
      const oldCacheDir = join(dirEslintCacheCustomDir, '.next', 'cache')
      const newCacheDir = join(dirEslintCacheCustomDir, 'build', 'cache')

      await fs.remove(oldCacheDir)
      await fs.remove(newCacheDir)

      await nextBuild(dirEslintCacheCustomDir, [])

      expect(fs.existsSync(oldCacheDir)).toBe(false)

      const files = await fs.readdir(join(newCacheDir, 'eslint/'))
      const cacheExists = files.some((f) => /\.cache/.test(f))

      expect(cacheExists).toBe(true)
    })
  })

  describe('Next Lint', () => {
    describe('First Time Setup ', () => {
      async function nextLintTemp() {
        const folder = join(
          os.tmpdir(),
          Math.random().toString(36).substring(2)
        )
        await fs.mkdirp(folder)
        await fs.copy(dirNoConfig, folder)

        try {
          const nextDir = dirname(require.resolve('next/package'))
          const nextBin = join(nextDir, 'dist/bin/next')

          const { stdout } = await execa('node', [
            nextBin,
            'lint',
            folder,
            '--strict',
          ])

          const pkgJson = JSON.parse(
            await fs.readFile(join(folder, 'package.json'), 'utf8')
          )
          const eslintrcJson = JSON.parse(
            await fs.readFile(join(folder, '.eslintrc.json'), 'utf8')
          )

          return { stdout, pkgJson, eslintrcJson }
        } finally {
          await fs.remove(folder)
        }
      }

      test('show a prompt to set up ESLint if no configuration detected', async () => {
        const eslintrcJson = join(dirFirstTimeSetup, '.eslintrc.json')
        await fs.writeFile(eslintrcJson, '')

        const { stdout, stderr } = await nextLint(dirFirstTimeSetup, [], {
          stdout: true,
          stderr: true,
        })
        const output = stdout + stderr
        expect(output).toContain('How would you like to configure ESLint?')

        // Different options that can be selected
        expect(output).toContain('Strict (recommended)')
        expect(output).toContain('Base')
        expect(output).toContain('Cancel')
      })

      test('installs eslint and eslint-config-next as devDependencies if missing', async () => {
        const { stdout, pkgJson } = await nextLintTemp()

        expect(stdout.replace(/(\r\n|\n|\r)/gm, '')).toContain(
          'Installing devDependencies:- eslint- eslint-config-next'
        )
        expect(pkgJson.devDependencies).toHaveProperty('eslint')
        expect(pkgJson.devDependencies).toHaveProperty('eslint-config-next')
      })

      test('creates .eslintrc.json file with a default configuration', async () => {
        const { stdout, eslintrcJson } = await nextLintTemp()

        expect(stdout).toContain(
          'We created the .eslintrc.json file for you and included your selected configuration'
        )
        expect(eslintrcJson).toMatchObject({ extends: 'next/core-web-vitals' })
      })

      test('shows a successful message when completed', async () => {
        const { stdout } = await nextLintTemp()

        expect(stdout).toContain(
          'ESLint has successfully been configured. Run next lint again to view warnings and errors'
        )
      })
    })

    test('shows warnings and errors', async () => {
      const { stdout, stderr } = await nextLint(dirCustomConfig, [], {
        stdout: true,
        stderr: true,
      })

      const output = stdout + stderr
      expect(output).toContain(
        'Warning: External synchronous scripts are forbidden'
      )
      expect(output).toContain(
        'Error: Comments inside children section of tag should be placed inside braces'
      )
    })

    test('shows warnings and errors with next/core-web-vitals config', async () => {
      const { stdout, stderr } = await nextLint(dirWebVitalsConfig, [], {
        stdout: true,
        stderr: true,
      })

      const output = stdout + stderr
      expect(output).toContain(
        "Warning: Do not use <img>. Use Image from 'next/image' instead."
      )
      expect(output).toContain(
        'Error: External synchronous scripts are forbidden'
      )
    })

    test('shows warnings and errors when extending plugin recommended config', async () => {
      const { stdout, stderr } = await nextLint(
        dirPluginRecommendedConfig,
        [],
        {
          stdout: true,
          stderr: true,
        }
      )

      const output = stdout + stderr
      expect(output).toContain(
        'Warning: External synchronous scripts are forbidden'
      )
      expect(output).toContain(
        'Error: next/document should not be imported outside of pages/_document.js.'
      )
    })

    test('shows warnings and errors when extending plugin core-web-vitals config', async () => {
      const { stdout, stderr } = await nextLint(
        dirPluginCoreWebVitalsConfig,
        [],
        {
          stdout: true,
          stderr: true,
        }
      )

      const output = stdout + stderr
      expect(output).toContain(
        "Warning: Do not use <img>. Use Image from 'next/image' instead."
      )
      expect(output).toContain(
        'Error: External synchronous scripts are forbidden'
      )
    })

    test('success message when no warnings or errors', async () => {
      const eslintrcJson = join(dirFirstTimeSetup, '.eslintrc.json')
      await fs.writeFile(eslintrcJson, '{ "extends": "next", "root": true }\n')

      const { stdout, stderr } = await nextLint(dirFirstTimeSetup, [], {
        stdout: true,
        stderr: true,
      })

      const output = stdout + stderr
      expect(output).toContain('No ESLint warnings or errors')
    })

    test("don't create .eslintrc file if package.json has eslintConfig field", async () => {
      const eslintrcFile =
        (await findUp(
          [
            '.eslintrc.js',
            '.eslintrc.yaml',
            '.eslintrc.yml',
            '.eslintrc.json',
            '.eslintrc',
          ],
          {
            cwd: '.',
          }
        )) ?? null

      try {
        // If we found a .eslintrc file, it's probably config from root Next.js directory. Rename it during the test
        if (eslintrcFile) {
          await fs.move(eslintrcFile, `${eslintrcFile}.original`)
        }

        const { stdout, stderr } = await nextLint(dirConfigInPackageJson, [], {
          stdout: true,
          stderr: true,
        })

        const output = stdout + stderr
        expect(output).not.toContain(
          'We created the .eslintrc file for you and included your selected configuration'
        )
      } finally {
        // Restore original .eslintrc file
        if (eslintrcFile) {
          await fs.move(`${eslintrcFile}.original`, eslintrcFile)
        }
      }
    })

    test('quiet flag suppresses warnings and only reports errors', async () => {
      const { stdout, stderr } = await nextLint(dirCustomConfig, ['--quiet'], {
        stdout: true,
        stderr: true,
      })

      const output = stdout + stderr
      expect(output).toContain(
        'Error: Comments inside children section of tag should be placed inside braces'
      )
      expect(output).not.toContain(
        'Warning: External synchronous scripts are forbidden'
      )
    })

    test('custom directories', async () => {
      const { stdout, stderr } = await nextLint(dirCustomDirectories, [], {
        stdout: true,
        stderr: true,
      })

      const output = stdout + stderr
      expect(output).toContain(
        'Error: Comments inside children section of tag should be placed inside braces'
      )
      expect(output).toContain(
        'Warning: External synchronous scripts are forbidden'
      )
    })

    test('max warnings flag errors when warnings exceed threshold', async () => {
      const { stdout, stderr } = await nextLint(
        dirMaxWarnings,
        ['--max-warnings', 1],
        {
          stdout: true,
          stderr: true,
        }
      )

      expect(stderr).not.toEqual('')
      expect(stderr).toContain(
        'Warning: External synchronous scripts are forbidden'
      )
      expect(stdout).not.toContain(
        'Warning: External synchronous scripts are forbidden'
      )
    })

    test('max warnings flag does not error when warnings do not exceed threshold', async () => {
      const { stdout, stderr } = await nextLint(
        dirMaxWarnings,
        ['--max-warnings', 2],
        {
          stdout: true,
          stderr: true,
        }
      )

      expect(stderr).toEqual('')
      expect(stderr).not.toContain(
        'Warning: External synchronous scripts are forbidden'
      )
      expect(stdout).toContain(
        'Warning: External synchronous scripts are forbidden'
      )
    })

    test('format flag supports additional user-defined formats', async () => {
      const { stdout, stderr } = await nextLint(
        dirMaxWarnings,
        ['-f', 'codeframe'],
        {
          stdout: true,
          stderr: true,
        }
      )

      const output = stdout + stderr
      expect(output).toContain(
        'warning: External synchronous scripts are forbidden'
      )
      expect(stdout).toContain('<script src="https://example.com" />')
      expect(stdout).toContain('2 warnings found')
    })

    test('eslint caching is enabled by default', async () => {
      const cacheDir = join(dirEslintCache, '.next', 'cache')

      await fs.remove(cacheDir)
      await nextLint(dirEslintCache, [])

      const files = await fs.readdir(join(cacheDir, 'eslint/'))
      const cacheExists = files.some((f) => /\.cache/.test(f))

      expect(cacheExists).toBe(true)
    })

    test('eslint caching is disabled with the --no-cache flag', async () => {
      const cacheDir = join(dirEslintCache, '.next', 'cache')

      await fs.remove(cacheDir)
      await nextLint(dirEslintCache, ['--no-cache'])

      expect(fs.existsSync(join(cacheDir, 'eslint/'))).toBe(false)
    })

    test('the default eslint cache lives in the user defined build directory', async () => {
      const oldCacheDir = join(dirEslintCacheCustomDir, '.next', 'cache')
      const newCacheDir = join(dirEslintCacheCustomDir, 'build', 'cache')

      await fs.remove(oldCacheDir)
      await fs.remove(newCacheDir)

      await nextLint(dirEslintCacheCustomDir, [])

      expect(fs.existsSync(oldCacheDir)).toBe(false)

      const files = await fs.readdir(join(newCacheDir, 'eslint/'))
      const cacheExists = files.some((f) => /\.cache/.test(f))

      expect(cacheExists).toBe(true)
    })

    test('the --cache-location flag allows the user to define a separate cache location', async () => {
      const cacheFile = join(dirEslintCache, '.eslintcache')

      await fs.remove(cacheFile)
      await nextLint(dirEslintCache, ['--cache-location', cacheFile])

      const hasCache = fs.existsSync(cacheFile)
      await fs.remove(cacheFile) // remove after generate
      expect(hasCache).toBe(true)
    })

    const getEslintCacheContent = async (cacheDir) => {
      const eslintCacheDir = join(cacheDir, 'eslint/')
      let files = await fs.readdir(eslintCacheDir)
      let cacheFiles = files.filter((f) => /\.cache/.test(f))
      expect(cacheFiles.length).toBe(1)
      const cacheFile = join(eslintCacheDir, cacheFiles[0])
      return await fs.readFile(cacheFile, 'utf8')
    }

    test('the default eslint caching strategy is metadata', async () => {
      const cacheDir = join(dirEslintCache, '.next', 'cache')

      await fs.remove(cacheDir)
      await nextLint(dirEslintCache)

      const defaultStrategyCache = await getEslintCacheContent(cacheDir)

      await fs.remove(cacheDir)
      await nextLint(dirEslintCache, ['--cache-strategy', 'metadata'])

      const metadataStrategyCache = await getEslintCacheContent(cacheDir)

      expect(metadataStrategyCache).toBe(defaultStrategyCache)
    })

    test('cache with content strategy is different from the one with default strategy', async () => {
      const cacheDir = join(dirEslintCache, '.next', 'cache')

      await fs.remove(cacheDir)
      await nextLint(dirEslintCache)

      const defaultStrategyCache = await getEslintCacheContent(cacheDir)

      await fs.remove(cacheDir)
      await nextLint(dirEslintCache, ['--cache-strategy', 'content'])

      const contentStrategyCache = await getEslintCacheContent(cacheDir)

      expect(contentStrategyCache).not.toBe(defaultStrategyCache)
    })

    test('file flag can selectively lint only a single file', async () => {
      const { stdout, stderr } = await nextLint(
        dirFileLinting,
        ['--file', 'utils/math.js'],
        {
          stdout: true,
          stderr: true,
        }
      )

      const output = stdout + stderr

      expect(output).toContain('utils/math.js')
      expect(output).toContain(
        'Comments inside children section of tag should be placed inside braces'
      )

      expect(output).not.toContain('pages/')
      expect(output).not.toContain('External synchronous scripts are forbidden')
    })

    test('file flag can selectively lints multiple files', async () => {
      const { stdout, stderr } = await nextLint(
        dirFileLinting,
        ['--file', 'utils/math.js', '--file', 'pages/bar.js'],
        {
          stdout: true,
          stderr: true,
        }
      )

      const output = stdout + stderr

      expect(output).toContain('utils/math.js')
      expect(output).toContain(
        'Comments inside children section of tag should be placed inside braces'
      )

      expect(output).toContain('pages/bar.js')
      expect(output).toContain(
        "Do not use <img>. Use Image from 'next/image' instead"
      )

      expect(output).not.toContain('pages/index.js')
      expect(output).not.toContain('External synchronous scripts are forbidden')
    })
  })
})
