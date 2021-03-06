# Changelog

This project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [4.3.2] - 2020-03-31

### Bugs fixed

- Although not part of the publicly documented API, the functions `isSavedToPod` and `hasRef` were no longer exported even though they were before, breaking code that relied on them. They are now exported again.

## [4.3.1] - 2020-03-31

### Bugs fixed

- A couple of types were removed from the type definitions in version 4.2.3 - although they were internal types, they still formed the basis of types that _were_ used externally, leading to problems for people trying to use TypeScript with TripleDoc. The relevant types are now exported again.

## [4.3.0] - 2020-03-12

### Deprecations

- For consistency's sake, `getSubjectsOfType` is now deprecated in favour of `getAllSubjectsOfType`. `getSubjectsOfType` will be removed in a future major release.

### New features

- An experimental method `experimental_getAllSubjects()` has been added to `TripleDocument`s. Whereas previously, you had to know the type of Subjects you wanted to access by calling `getSubjectsOfType()`, you can now simply access all of them, unfiltered. Note that this is still an experimental API, so it might change in a minor or patch release. If you have a use case for this method, please leave a comment at https://gitlab.com/vincenttunru/tripledoc/-/issues/27 so we can make sure this API works for you.
- `getAllSubjectsOfType` has been added to replace `getSubjectsOfType`. This is essentially a rename to make this method consistent with other methods that return multiple results. It has the same type signature as `getSubjectsOfType`.

## [4.2.3] - 2020-03-11

### Changed

- Internal API's are no longer included in the TypeScript type declarations. They were not publicly documented on the website and hence should not be used if you rely on semantic versioning to tell you when an upgrade will be breaking, but having one's editor autocomplete it might still tempt people into using them. Therefore, they are now specifically excluded. (Note that the type definitions for deprecated and experimental API's are still included, but those, too, should generally not be relied on.)

## [4.2.2] - 2020-03-04

### Changed

- This release should not contain any functional changes, but quite a bit of refactoring has gone on ([#36](https://gitlab.com/vincenttunru/tripledoc/issues/36), [#41](https://gitlab.com/vincenttunru/tripledoc/issues/41)). The goal was to make it easier to support other libraries than N3.js if needed, and to make it easier to contribute. They're published as a separate point release so that anyone reporting problems can easily revert back to the previous versions while the problem is being resolved.

### Breaking changes

- Two exported TypeScript interfaces have been renamed (BareTripleDocument to LocalTripleDocumentForContainer and LocalTripleDocument to LocalTripleDocumentWithRef). This is technically a breaking change, although it doesn't seem like any external code was using these, so to minimise the upgrade burden for in practice 100% of users, I decided to push this out as a patch release.

## [4.2.1] - 2020-02-13

### Bugs fixed

- When sending requests to the Solid server to update a Document, the `DELETE` and `INSERT` statements were not separated by a semi-colon, which some Solid servers might expect.

## [4.2.0] - 2020-02-05

### Deprecations

- The `addLiteral`, `setLiteral` and `removeLiteral` methods on `TripleSubject`s are now deprecated, and will be removed in a future major release. They can be replaced by their data type-specific equivalents (e.g. `addString`, `setInteger`, `removeDateTime`).

### New features

- String literals that have been stored with a locale specified (e.g. `nl-nl` for strings in Dutch) can now be accessed through `TripleSubject.getLocaleString` and `TripleSubject.getAllLocaleStrings`. Note that this will not return strings without a locale specified, nor will it return strings whose locale partially matches (e.g. strings with the locale `nl` will not be returned when `nl-nl` is requested, nor vice versa). As was already the case, `getString()` and `getAllStrings()` will not return strings with a locale specified.
- To manipulate locale-specific strings, the `addLocaleString`, `setLocaleString` and `removeLocaleString` methods have been added to `TripleSubject`s.
- Data type-specific methods have been added to `TripleSubject`s for manipulating Literals, to replace `addLiteral`, `setLiteral` and `removeLiteral`.

### Bugs fixed

- `getSubject` was exposed on `BareTripleDocument`s, which represents a Document that does not exist on the Pod yet, even though such a Document can by definition not contain any Subjects yet. The method is now only available when it can actually return a value.
- Tripledoc uses [N3.js](http://rdf.js.org/N3.js/) internally, and was accidentally relying on some of its internal data structures, which means this could break with a new release. Tripledoc has now migrated to a more reliable public API. Behaviour for consumers of Tripledoc should not change.

## [4.1.0] - 2020-01-28

### New features

- [rdf-namespaces](https://www.npmjs.com/package/rdf-namespaces) is no longer a direct dependency, so if you use Tripledoc in an environment without [dead-code elimination](https://webpack.js.org/guides/tree-shaking/), the bundle size should now be a lot smaller.
- Tripledoc now explicitly indicates that its exports are [free of side-effects](https://webpack.js.org/guides/tree-shaking/#mark-the-file-as-side-effect-free). This will allow certain bundles to actually eliminate unused modules.

## [4.0.1] - 2020-01-14

### Bugs fixed

- After creating a Document in a Container, the experimental API `getAclRef()` would return the ACL of the Container rather than of the Document. It now returns the proper Document's ACL location.

## [4.0.0] - 2019-12-31

### Breaking changes

- There are now two more types representing a Document in various states: a Document that is not stored yet, but whose IRI is known (`InMemoryTripleDocument`), and a Document which is not stored yet and for which no final IRI known yet (`BareTripleDocument`). Not all methods that used to be available on a regular TripleDocument are available on these new types, since they are do not apply to them. For example, calling `asRef()` on a Document for which no Reference is known yet is not very useful. The primary impact of this change is some methods now return these types, so if you use TypeScript, you might need to adjust some of your code to expect these new interfaces. In most cases, however, existing code should continue to work.
- Calling `.save()` on a TripleDocument will now throw if the save fails. (Previously, it would only throw on errors making the requests, but not when a response would come in successfully - even if that response itself indicated an unsuccessful operation.)

### New features

- With the new `createDocumentInContainer()` API, it is now possible to initialise a Document in a given Container, i.e. for which the final IRI is not known yet. This is useful for e.g. creating a Document in a Container to which the user only has Append permissions, like someone's Inbox.
- When saving a Document fails, `.save()` will now throw an error, allowing you to gracefully deal with that.

## [3.1.0] - 2019-12-31

### New features

- When fetching a Document results in an invalid response (e.g. a 403 Response), the Promise will now reject with a sensible error message, rather than a cryptic message about being unable to parse the response.

## [3.0.1] - 2019-11-21

### Bugs fixed

- When you attempted to create a Document that already existed (i.e. `createDocument(<some existing URL>).save()`), Tripledoc would not tell the server that it did not expect it to exist yet. But no more! Tripledoc will now send the `If-None-Match` header, and the server will reject the request if the Document _does_ already exist.

## [3.0.0] - 2019-11-18

### Breaking changes

- Tripledoc no longer wraps rdflib, but instead uses N3.js behind the screens. This brings a number of advantages, like a smaller bundle size and hence better performance, less logging to the console, and better test coverage. However, the main change is that calls to `fetchDocument` are no longer cached: every new invocation will perform a new HTTP request. Additionally, a number of functions that weren't part of the public, documented API, like `getStore`, are no longer included.
- Tripledoc now expects [solid-auth-client](https://www.npmjs.com/package/solid-auth-client) to be available, whereas it would previously be installed automatically as a dependency of rdflib. If you have not added solid-auth-client as a dependency yet, run `npm install solid-auth-client` after this upgrade.

## [2.4.0] - 2019-11-14

### New features

- The npm package for Tripledoc now also includes a version that uses UMD for modules. This allows you to use Tripledoc without a bundler like Webpack, by including a `<script>` tag in your HTML. Do note that the use of a bundler is still the recommended way to use Tripledoc: this should result in better performance by not shipping and parsing code that's not being used.

### Experimental changes

- A TripleDocument now provides the experimental `getWebSocketRef` method. This method provides access to a WebSocket URL that can provide real-time notifications when a Document was updated. Since this part of the spec is likely to change in the future and is currently not very well-documented, Tripledoc provides no stability guarantees about this method.

## [2.3.0] - 2019-11-12

### Experimental changes

- A new `getLocalSubject` method (and the corresponding `getAllLocalSubjects`) has been added to the `TripleSubject` interface. It is still experimental while we figure out the naming and API, so don't rely on this for production applications - its interface might change without warning in a future minor or patch release. It enables access to data hidden in [`BlankNode`s](https://rdf.js.org/data-model-spec/#blanknode-interface). It is not currently possible to write your own Blank Nodes using Tripledoc's API.

## [2.2.0] - 2019-11-04

### New features

- TripleDocuments now have a [[RemoveSubject]] method, to remove a Subject and all its Statements.

### Bugs fixed

- The deprecated `NodeRef` type was accidentally removed in v2.1.0. You shouldn't use it anymore, but it's merely deprecated, not removed - which would be a breaking change.

## [2.1.0] - 2019-10-28

### Deprecations

A number of deprecations to remove mentions of "nodes", simplifying them to simply "references".

- `getNodeRef`, `getAllNodeRefs`, `addNodeRef`, `removeNodeRef`, `setNodeRef` and `asNodeRef` have been superseded by `getRef`, `getAllRefs`, `addRef`, `removeRef`, `setRef` and `asRef`, respectively, and are therefore now deprecated - they will be removed in a future major version.
- The exported type `NodeRef` is now called `Reference`, and the former is therefore deprecated.

## [2.0.0] - 2019-10-24

### Breaking changes

- A TripleDocument is no longer mutable, meaning that the values you read from it (Subjects, properties on those Subjects, …) will not change after you call `save()` on it, even if those values have been updated in the Pod. Instead, `save()` will now return a new TripleDocument that _does_ contain the updated values. This provides benefits to those wanting to access the "old" data, those who prefer working with immutable data structures, or work with a library that does, such as React.

## [1.4.0] - 2019-10-14

### Deprecations

- `getLiteral` and `getAllLiterals` have been superseded by their respective type-specific methods (`getString`, `getInteger`, etc.), and are therefore now deprecated - they will be removed in a future major version.

### New features

- You can now query specifically for string, integer, decimal or DateTime values on a Subject, instead of having to check whether the return value of `getLiteral` (or `getAllLiterals`) is of the type you want.

### Bug fixes

- The source directory for the website is no longer published along with the package itself to npm, saving you precious bytes on your hard drive.

## [1.3.2] - 2019-10-02

### Bugfixes

- Saving an existing Document did not work due to [a bug in rdflib](https://github.com/linkeddata/rdflib.js/issues/359). Pending a fix upstream, Tripledoc will temporarily include an older version of rdflib.

## [1.3.1] - 2019-10-01

### Experimental changes

- The `getAcl` method on a TripleDocument did not work for relative ACL URLs (as returned by Node Solid Server). It now has the more consistent name `getAclRef`, and should work with relative URLs. Additionally, it can now also return the location of the ACL for a newly created Document, provided it has been `save`d. Do keep in mind that this method is still experimental and may therefore be changed in a future patch release.

## [1.3.0] - 2019-09-06

### New features

- Tripledoc now also publishes a version that exports ES Modules - find it in the `module` field in `package.json`. This should allow bundles to only import the modules that are needed, theoretically significantly reducing the bundled size.

## [1.2.0] - 2019-09-05

### New features

- It is now possible to remove properties from a Subject using [`removeLiteral`](https://vincenttunru.gitlab.io/tripledoc/docs/api/interfaces/triplesubject/#removeliteral), [`removeNodeRef`](https://vincenttunru.gitlab.io/tripledoc/docs/api/interfaces/triplesubject/#removenoderef), and [`removeAll`](https://vincenttunru.gitlab.io/tripledoc/docs/api/interfaces/triplesubject/#removeall), and to replace existing values with a new one using [`setLiteral`](https://vincenttunru.gitlab.io/tripledoc/docs/api/interfaces/triplesubject/#setliteral) and [`setNodeRef`](https://vincenttunru.gitlab.io/tripledoc/docs/api/interfaces/triplesubject/#setnoderef).

## [1.1.0] - 2019-09-03

### New features

- It is now possible to store and retrieve Date objects to and from a Pod.

### Fixed bugs

- Numbers stored in the Pod were returned as strings.

## [1.0.0] - 2019-08-28

### New features

- First release! With this release, it is possible to fetch a Document, read the properties of the Subjects it contains, add new properties, and to save them back to the Pod.
