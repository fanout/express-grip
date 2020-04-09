# express-grip Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [Planned for 2.0.0]
Major update with great improvements in usability, with support for modern
language features such as `class` and `async`/`await`.  Now also uses
`@fanoutio/pubcontrol@2` and `@fanoutio/grip@2`.

### To be Added
- To add Typescript annotations for IDE completion and static type checking.

### To be Changed
### To be Removed

## [2.0.0-beta.0] - 2020-01-15
### Added
- Added this Changelog file.
- Added ESM build. Uses Rollup (https://rollupjs.org/) to build bundles for consumption as
  CommonJS, ESM, and the Browser.
- Added two demos that can be run out of the box, for http and ws. These are designed
  to be used with pushpin (https://pushpin.org).
- Added a shimmed `Buffer` object to browser build, as it is needed during JWT authorization.
- IDE metadata for IntelliJ IDEA.  

### Changed
- Now distributed as a public scoped package `@fanouio/express-grip`.
- Source files and tests rewritten in modern style JavaScript
- Source files moved from `/lib` to `/src`
- `ExpressGrip` is no longer a single global instance. Instead, the default
  export of this package is a constructor function that accepts the options to
  define the instance's behavior.
- `ExpressGrip` is now an ES6 classes.
- Start using "changelog" over "change log" since it's the common usage.
- Bump major version to 2 to indicate that this is a modernized new version.
- Improved README by being more straightforward with the basic use case.

### Removed
