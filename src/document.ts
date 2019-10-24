import LinkHeader from 'http-link-header';
import { rdf } from 'rdf-namespaces';
import { Quad } from 'n3';
import { update, create, get } from './store';
import { findSubjectInTriples, FindEntityInTriples, FindEntitiesInTriples, findSubjectsInTriples } from './getEntities';
import { TripleSubject, initialiseSubject } from './subject';
import { turtleToTriples } from './turtle';
import { Reference, isReference } from '.';

/**
 * @ignore This is documented on use.
 */
export interface NewSubjectOptions {
  identifier?: string;
  identifierPrefix?: string;
};
export interface TripleDocument {
  /**
   * Add a Subject — note that it is not written to the Pod until you call [[save]].
   *
   * @param addSubject.options By default, Tripledoc will automatically generate an identifier with
   *                           which this Subject can be identified within the Document, and which
   *                           is likely to be unique. The `options` parameter has a number of
   *                           optional properties. The first, `identifier`, takes a string. If set,
   *                           Tripledoc will not automatically generate an identifier. Instead, the
   *                           value of this parameter will be used as the Subject's identifier.
   *                           The second optional parameter, `identifierPrefix`, is also a string.
   *                           If set, it will be prepended before this Subject's identifier,
   *                           whether that's autogenerated or not.
   * @returns A [[TripleSubject]] instance that can be used to define its properties.
   */
  addSubject: (options?: NewSubjectOptions) => TripleSubject;
  /**
   * Remove a Subject - note that it is not removed from the Pod until you call [[save]].
   *
   * @param removeSubject.subject The IRI of the Subject to remove.
   */
  removeSubject: (subject: Reference) => void;
  /**
   * Find a Subject which has the value of `objectRef` for the Predicate `predicateRef`.
   *
   * @param findSubject.predicateRef The Predicate that must match for the desired Subject.
   * @param findSubject.objectRef The Object that must match for the desired Subject.
   * @returns `null` if no Subject matching `predicateRef` and `objectRef` is found,
   *          a random one of the matching Subjects otherwise.
   */
  findSubject: (predicateRef: Reference, objectRef: Reference) => TripleSubject | null;
  /**
   * Find Subjects which have the value of `objectRef` for the Predicate `predicateRef`.
   *
   * @param findSubjects.predicateRef - The Predicate that must match for the desired Subjects.
   * @param findSubjects.objectRef - The Object that must match for the desired Subjects.
   * @returns An array with every matching Subject, and an empty array if none match.
   */
  findSubjects: (predicateRef: Reference, objectRef: Reference) => TripleSubject[];
  /**
   * Given the IRI of a Subject, return an instantiated [[TripleSubject]] representing its values.
   *
   * @param getSubject.subjectRef IRI of the Subject to inspect.
   * @returns Instantiation of the Subject at `subjectRef`, ready for inspection.
   */
  getSubject: (subjectRef: Reference) => TripleSubject;
  /**
   * Get all Subjects in this Document of a given type.
   *
   * @param getSubjectsOfType.typeRef IRI of the type the desired Subjects should be of.
   * @returns All Subjects in this Document that are of the given type.
   */
  getSubjectsOfType: (typeRef: Reference) => TripleSubject[];
  /**
   * @ignore Experimental API, might change in the future to return an instantiated Document
   * @deprecated Replaced by [[getAclRef]]
   */
  getAcl: () => Reference | null;
  /**
   * @ignore Experimental API, might change in the future to return an instantiated Document
   */
  getAclRef: () => Reference | null;
  /**
   * @ignore Experimental API, will probably change as the Solid specification changes to no longer support WebSockets
   */
  getWebSocketRef: () => Reference | null;
  /**
   * @returns The IRI of this Document.
   */
  asRef: () => Reference;
  /**
   * @ignore Deprecated.
   * @deprecated Replaced by [[asRef]].
   */
  asNodeRef: () => Reference;
  /**
   * Persist Subjects in this Document to the Pod.
   *
   * @param save.subjects Optional array of specific Subjects within this Document that should be
   *                      written to the Pod, i.e. excluding Subjects not in this array.
   * @return The updated Document with persisted Subjects.
   */
  save: (subjects?: TripleSubject[]) => Promise<TripleDocument>;
  /**
   * @deprecated
   * @ignore This is mostly a convenience function to make it easy to work with n3 and tripledoc
   *         simultaneously. If you rely on this, it's probably best to either file an issue
   *         describing what you want to do that Tripledoc can't do directly, or to just use n3
   *         directly.
   * @returns The Triples pertaining to this Document that are stored on the user's Pod. Note that
   *          this does not return Triples that have not been saved yet - those can be retrieved
   *          from the respective [[TripleSubject]]s.
   */
  getTriples: () => Quad[];
  /**
   * @deprecated Replaced by [[getTriples]]
   */
  getStatements: () => Quad[];
};

/**
 * Initialise a new Turtle document
 *
 * Note that this Document will not be created on the Pod until you call [[save]] on it.
 *
 * @param ref URL where this document should live
 */
export function createDocument(ref: Reference): TripleDocument {
  return instantiateDocument(ref, [], { existsOnPod: false });
}

/**
 * Retrieve a document containing RDF triples
 *
 * @param documentRef Where the document lives.
 * @returns Representation of triples in the document at `uri`.
 */
export async function fetchDocument(uri: Reference): Promise<TripleDocument> {
  // Remove fragment identifiers (e.g. `#me`) from the URI:
  const docUrl = new URL(uri);
  const documentRef: Reference = docUrl.origin + docUrl.pathname + docUrl.search;

  const response = await get(documentRef);
  const rawDocument = await response.text();
  const triples = await turtleToTriples(rawDocument, documentRef);

  let aclRef: Reference | undefined = extractAclRef(response, documentRef);
  const webSocketRef: Reference | null = response.headers.get('Updates-Via');

  return instantiateDocument(
    documentRef,
    triples,
    {
      aclRef: aclRef,
      webSocketRef: webSocketRef || undefined,
      existsOnPod: true,
    },
  );
}

function extractAclRef(response: Response, documentRef: Reference) {
  let aclRef: Reference | undefined;
  const linkHeader = response.headers.get('Link');
  // `LinkHeader` might not be present when using the UMD build in the browser,
  // in which case we just don't parse the ACL header. It is recommended to use a non-UMD build
  // that supports code splitting anyway.
  if (linkHeader && LinkHeader) {
    const parsedLinks = LinkHeader.parse(linkHeader);
    const aclLinks = parsedLinks.get('rel', 'acl');
    if (aclLinks.length === 1) {
      aclRef = new URL(aclLinks[0].uri, documentRef).href;
    }
  }
  return aclRef;
}

interface DocumentMetadata {
  aclRef?: Reference;
  webSocketRef?: Reference;
  existsOnPod?: boolean;
};
function instantiateDocument(documentRef: Reference, triples: Quad[], metadata: DocumentMetadata): TripleDocument {
  const asRef = () => documentRef;

  const getAclRef: () => Reference | null = () => {
    return metadata.aclRef || null;
  };
  const getWebSocketRef: () => Reference | null = () => {
    return metadata.webSocketRef || null;
  };

  const accessedSubjects: { [iri: string]: TripleSubject } = {};
  const getSubject = (subjectRef: Reference) => {
    if (!accessedSubjects[subjectRef]) {
      accessedSubjects[subjectRef] = initialiseSubject(tripleDocument, subjectRef);
    }
    return accessedSubjects[subjectRef];
  };

  const findSubject = (predicateRef: Reference, objectRef: Reference) => {
    const findSubjectRef = withDocumentSingular(findSubjectInTriples, documentRef, triples);
    const subjectRef = findSubjectRef(predicateRef, objectRef);
    if (!subjectRef || !isReference(subjectRef)) {
      return null;
    }
    return getSubject(subjectRef);
  };

  const findSubjects = (predicateRef: Reference, objectRef: Reference) => {
    const findSubjectRefs = withDocumentPlural(findSubjectsInTriples, documentRef, triples);
    const subjectRefs = findSubjectRefs(predicateRef, objectRef);
    return subjectRefs.filter(isReference).map(getSubject);
  };
  const getSubjectsOfType = (typeRef: Reference) => {
    return findSubjects(rdf.type, typeRef);
  };

  const addSubject = (
    {
      identifier = generateIdentifier(),
      identifierPrefix = '',
    }: NewSubjectOptions = {},
  ) => {
    const subjectRef: Reference = documentRef + '#' + identifierPrefix + identifier;
    return getSubject(subjectRef);
  };

  const removeSubject = (subjectRef: Reference) => {
    const subject = getSubject(subjectRef);
    return subject.clear();
  };

  const save = async (subjects = Object.values(accessedSubjects)) => {
    const relevantSubjects = subjects.filter(subject => subject.getDocument().asRef() === documentRef);
    type UpdateTriples = [Quad[], Quad[]];
    const [allDeletions, allAdditions] = relevantSubjects.reduce<UpdateTriples>(
      ([deletionsSoFar, additionsSoFar], subject) => {
        const [deletions, additions] = subject.getPendingTriples();
        return [deletionsSoFar.concat(deletions), additionsSoFar.concat(additions)];
      },
      [[], []],
    );

    let newTriples: Quad[] = triples
      .concat(allAdditions)
      .filter(tripleToDelete => allDeletions.findIndex((triple) => triple.equals(tripleToDelete)) === -1);
    if (!metadata.existsOnPod) {
      const response = await create(documentRef, allAdditions);
      const aclRef = extractAclRef(response, documentRef);
      if (aclRef) {
        metadata.aclRef = aclRef;
      }
      const webSocketRef = response.headers.get('Updates-Via');
      if (webSocketRef) {
        metadata.webSocketRef = webSocketRef;
      }

      metadata.existsOnPod = true;
    } else {
      await update(documentRef, allDeletions, allAdditions);
    }

    // Instantiate a new TripleDocument that includes the updated Triples:
    return instantiateDocument(documentRef, newTriples, metadata);
  };

  const getTriples = () => triples;

  const tripleDocument: TripleDocument = {
    addSubject: addSubject,
    removeSubject: removeSubject,
    getSubject: getSubject,
    getSubjectsOfType: getSubjectsOfType,
    findSubject: findSubject,
    findSubjects: findSubjects,
    getAclRef: getAclRef,
    getWebSocketRef: getWebSocketRef,
    asRef: asRef,
    save: save,
    getTriples: getTriples,
    // Deprecated aliases, included for backwards compatibility:
    asNodeRef: asRef,
    getAcl: getAclRef,
    getStatements: getTriples,
  };
  return tripleDocument;
}

const withDocumentSingular = (
  getEntityFromTriples: FindEntityInTriples,
  document: Reference,
  triples: Quad[],
) => {
  return (knownEntity1: Reference, knownEntity2: Reference) =>
    getEntityFromTriples(triples, knownEntity1, knownEntity2, document);
};
const withDocumentPlural = (
  getEntitiesFromTriples: FindEntitiesInTriples,
  document: Reference,
  triples: Quad[],
) => {
  return (knownEntity1: Reference, knownEntity2: Reference) =>
    getEntitiesFromTriples(triples, knownEntity1, knownEntity2, document);
};

/**
 * Generate a string that can be used as the unique identifier for a Subject
 *
 * This function works by starting with a date string (so that Subjects can be
 * sorted chronologically), followed by a random number generated by taking a
 * random number between 0 and 1, and cutting off the `0.`.
 *
 * @ignore
 * @returns An string that's likely to be unique
 */
const generateIdentifier = () => {
  return Date.now().toString() + Math.random().toString().substring('0.'.length);
}
