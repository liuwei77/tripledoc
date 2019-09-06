import { graph, Fetcher, UpdateManager, Statement } from 'rdflib';

const store = graph();
const fetcher = new Fetcher(store, undefined);
const updater = new UpdateManager(store);

/**
 * Single instance of an rdflib store, caches all fetched data
 *
 * @ignore Can be used as an escape hatch for people who want to use rdflib directly, but if that
 *         is necessary, please consider submitting a feature request describing your use case
 *         on Tripledoc first.
 */
export function getStore() {
  return store;
}

/**
 * Single instance of an rdflib fetcher
 *
 * @ignore Can be used as an escape hatch for people who want to use rdflib directly, but if that
 *         is necessary, please consider submitting a feature request describing your use case
 *         on Tripledoc first.
 */
export function getFetcher() {
  return fetcher;
}

/**
 * Single instance of an rdflib updater
 *
 * @ignore Can be used as an escape hatch for people who want to use rdflib directly, but if that
 *         is necessary, please consider submitting a feature request describing your use case
 *         on Tripledoc first.
 */
export function getUpdater() {
  return updater;
}

/**
 * Utility function that properly promisifies the RDFLib UpdateManager's update function
 *
 * @param statementsToDelete Statements currently present on the Pod that should be deleted.
 * @param statementsToAdd Statements not currently present on the Pod that should be added.
 * @returns Promise that resolves when the update was executed successfully, and rejects if not.
 * @ignore Should not be used by library consumers directly.
 */
/* istanbul ignore next Just a thin wrapper around rdflib, yet cumbersome to test due to side effects */
export function update(statementsToDelete: Statement[], statementsToAdd: Statement[]) {
  const promise = new Promise((resolve, reject) => {
    const updater = getUpdater();
    updater.update(statementsToDelete, statementsToAdd, (_uri, success, errorBody) => {
      if(success) {
        return resolve();
      }
      return reject(new Error(errorBody));
    })
  });

  return promise;
}
