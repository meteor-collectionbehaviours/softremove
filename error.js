// @flow
export default class SoftRemoveError extends Error {
  constructor() {
    super();
    this.name = 'collectionbehaviours:softremove';
  }
}
