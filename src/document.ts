import { Statement } from 'rdflib';
import LinkHeader from 'http-link-header';
import { rdf } from 'rdf-namespaces';
import { getFetcher, getStore, getUpdater, update, create } from './store';
import { findSubjectInStore, FindEntityInStore, FindEntitiesInStore, findSubjectsInStore } from './getEntities';
import { TripleSubject, initialiseSubject } from './subject';
import { NodeRef, isLiteral, isNodeRef } from '.';

/**
 * @ignore This is documented on use.
 */
export interface NewSubjectOptions {
  identifier?: string;
  identifierPrefix?: string;
};
export interface TripleDocument {
  /**
   * Add a subject — note that it is not written to the Pod until you call [[save]].
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
   * Find a Subject which has the value of `objectRef` for the Predicate `predicateRef`.
   *
   * @param findSubject.predicateRef The Predicate that must match for the desired Subject.
   * @param findSubject.objectRef The Object that must match for the desired Subject.
   * @returns `null` if no Subject matching `predicateRef` and `objectRef` is found,
   *          a random one of the matching Subjects otherwise.
   */
  findSubject: (predicateRef: NodeRef, objectRef: NodeRef) => TripleSubject | null;
  /**
   * Find Subjects which have the value of `objectRef` for the Predicate `predicateRef`.
   *
   * @param findSubjects.predicateRef - The Predicate that must match for the desired Subjects.
   * @param findSubjects.objectRef - The Object that must match for the desired Subjects.
   * @returns An array with every matching Subject, and an empty array if none match.
   */
  findSubjects: (predicateRef: NodeRef, objectRef: NodeRef) => TripleSubject[];
  /**
   * Given the IRI of a Subject, return an instantiated [[TripleSubject]] representing its values.
   *
   * @param getSubject.subjectRef IRI of the Subject to inspect.
   * @returns Instantiation of the Subject at `subjectRef`, ready for inspection.
   */
  getSubject: (subjectRef: NodeRef) => TripleSubject;
  /**
   * Get all Subjects in this Document of a given type.
   *
   * @param getSubjectsOfType.typeRef IRI of the type the desired Subjects should be of.
   * @returns All Subjects in this Document that are of the given type.
   */
  getSubjectsOfType: (typeRef: NodeRef) => TripleSubject[];
  /**
   * @deprecated Replaced by [[getAclRef]]
   */
  getAcl: () => NodeRef | null;
  /**
   * @ignore Experimental API, might change in the future to return an instantiated Document
   */
  getAclRef: () => NodeRef | null;
  /**
   * @returns The IRI of this Document.
   */
  asNodeRef: () => NodeRef;
  /**
   * Persist Subjects in this Document to the Pod.
   *
   * @param save.subjects Optional array of specific Subjects within this Document that should be
   *                      written to the Pod, i.e. excluding Subjects not in this array.
   * @return The Subjects that were persisted.
   */
  save: (subjects?: TripleSubject[]) => Promise<TripleSubject[]>;
};

/**
 * Initialise a new Turtle document
 *
 * Note that this Document will not be created on the Pod until you call [[save]] on it.
 *
 * @param ref URL where this document should live
 * @param statements Initial statements to be included in this document
 */
export function createDocument(ref: NodeRef): TripleDocument {
  return instantiateDocument(ref, { existsOnPod: false });
}

/**
 * Retrieve a document containing RDF triples
 *
 * Note that if you fetch the same document twice, it will be cached; only one
 * network request will be performed.
 *
 * @param documentRef Where the document lives.
 * @returns Representation of triples in the document at `uri`.
 */
export async function fetchDocument(documentRef: NodeRef): Promise<TripleDocument> {
  const fetcher = getFetcher();
  const response = await fetcher.load(documentRef);

  let aclRef: NodeRef | undefined = extractAclRef(response, documentRef);

  return instantiateDocument(documentRef, { aclRef: aclRef, existsOnPod: true });
}

function extractAclRef(response: Response, documentRef: NodeRef) {
  let aclRef: NodeRef | undefined;
  const linkHeader = response.headers.get('Link');
  if (linkHeader) {
    const parsedLinks = LinkHeader.parse(linkHeader);
    const aclLinks = parsedLinks.get('rel', 'acl');
    if (aclLinks.length === 1) {
      aclRef = new URL(aclLinks[0].uri, documentRef).href;
    }
  }
  return aclRef;
}

interface DocumentMetadata {
  aclRef?: NodeRef;
  existsOnPod?: boolean;
};
function instantiateDocument(uri: NodeRef, metadata: DocumentMetadata): TripleDocument {
  const docUrl = new URL(uri);
  // Remove fragment identifiers (e.g. `#me`) from the URI:
  const documentRef: NodeRef = docUrl.origin + docUrl.pathname + docUrl.search;

  const getAclRef: () => NodeRef | null = () => {
    return metadata.aclRef || null;
  };

  const accessedSubjects: { [iri: string]: TripleSubject } = {};
  const getSubject = (subjectRef: NodeRef) => {
    if (!accessedSubjects[subjectRef]) {
      accessedSubjects[subjectRef] = initialiseSubject(tripleDocument, subjectRef);
    }
    return accessedSubjects[subjectRef];
  };

  const findSubject = (predicateRef: NodeRef, objectRef: NodeRef) => {
    const findSubjectRef = withDocumentSingular(findSubjectInStore, documentRef);
    const subjectRef = findSubjectRef(predicateRef, objectRef);
    if (!subjectRef || isLiteral(subjectRef)) {
      return null;
    }
    return getSubject(subjectRef);
  };

  const findSubjects = (predicateRef: NodeRef, objectRef: NodeRef) => {
    const findSubjectRefs = withDocumentPlural(findSubjectsInStore, documentRef);
    const subjectRefs = findSubjectRefs(predicateRef, objectRef);
    return subjectRefs.filter(isNodeRef).map(getSubject);
  };
  const getSubjectsOfType = (typeRef: NodeRef) => {
    return findSubjects(rdf.type, typeRef);
  };

  const addSubject = (
    {
      identifier = generateIdentifier(),
      identifierPrefix = '',
    }: NewSubjectOptions = {},
  ) => {
    const subjectRef: NodeRef = documentRef + '#' + identifierPrefix + identifier;
    return getSubject(subjectRef);
  };

  const save = async (subjects = Object.values(accessedSubjects)) => {
    const relevantSubjects = subjects.filter(subject => subject.getDocument().asNodeRef() === documentRef);
    type UpdateStatements = [Statement[], Statement[]];
    const [allDeletions, allAdditions] = relevantSubjects.reduce<UpdateStatements>(
      ([deletionsSoFar, additionsSoFar], subject) => {
        const [deletions, additions] = subject.getPendingStatements();
        return [deletionsSoFar.concat(deletions), additionsSoFar.concat(additions)];
      },
      [[], []],
    );

    if (!metadata.existsOnPod) {
      const response = await create(documentRef, allAdditions);
      const aclRef = extractAclRef(response, documentRef);
      if (aclRef) {
        metadata.aclRef = aclRef;
      }

      metadata.existsOnPod = true;
    } else {
      await update(allDeletions, allAdditions);
    }

    relevantSubjects.forEach(subject => subject.onSave());
    return relevantSubjects;
  };

  const tripleDocument: TripleDocument = {
    addSubject: addSubject,
    getSubject: getSubject,
    getSubjectsOfType: getSubjectsOfType,
    findSubject: findSubject,
    findSubjects: findSubjects,
    getAcl: getAclRef,
    getAclRef: getAclRef,
    asNodeRef: () => documentRef,
    save: save,
  };
  return tripleDocument;
}

const withDocumentSingular = (getEntityFromStore: FindEntityInStore, document: NodeRef) => {
  const store = getStore();
  return (knownEntity1: NodeRef, knownEntity2: NodeRef) =>
    getEntityFromStore(store, knownEntity1, knownEntity2, document);
};
const withDocumentPlural = (getEntitiesFromStore: FindEntitiesInStore, document: NodeRef) => {
  const store = getStore();
  return (knownEntity1: NodeRef, knownEntity2: NodeRef) =>
    getEntitiesFromStore(store, knownEntity1, knownEntity2, document);
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
