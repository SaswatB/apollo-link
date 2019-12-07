import { ApolloLink, Operation, FetchResult, Observable } from 'apollo-link';

import { SubscriptionClient, ClientOptions } from 'subscriptions-transport-ws';

export namespace WebSocketLink {
  /**
   * Configuration to use when constructing the subscription client (subscriptions-transport-ws).
   */
  export interface Configuration {
    /**
     * The endpoint to connect to.
     */
    uri: string;

    /**
     * Options to pass when constructing the subscription client.
     */
    options?: ClientOptions;

    /**
     * A custom WebSocket implementation to use.
     */
    webSocketImpl?: any;
  }
}

// For backwards compatibility.
export import WebSocketParams = WebSocketLink.Configuration;

export class WebSocketLink extends ApolloLink {
  private subscriptionClient: SubscriptionClient;

  constructor(
    paramsOrClient: WebSocketLink.Configuration | SubscriptionClient,
  ) {
    super();

    if (paramsOrClient instanceof SubscriptionClient) {
      this.subscriptionClient = paramsOrClient;
    } else {
      this.subscriptionClient = new SubscriptionClient(
        paramsOrClient.uri,
        paramsOrClient.options,
        paramsOrClient.webSocketImpl,
      );
    }
  }

  public request(operation: Operation): Observable<FetchResult> | null {
    return new Observable<FetchResult>(obs => {
      let unsubscribed = false;
      // helper function to request new subscriptions
      let subscription;
      const createSubscription = () => {
        subscription = this.subscriptionClient.request(operation).subscribe({
          next(value) {
            obs.next(value);
          },
          error(err) {
            obs.error(err);
          },
          complete() {
            obs.complete();
          },
        });
      };
      // start off with a new subscription request
      createSubscription();
      // add a event listener to resubscribe on reconnect
      const off = this.subscriptionClient.onReconnected(async () => {
        // unsubscribe from the existing request
        subscription.unsubscribe();
        // call the reconnect callback (such as a function to re-execute a query), if necessary
        const context = operation.getContext();
        if (context.onReconnect) {
          await context.onReconnect();
        }
        // subscribe with a new request if unsubscribe wasn't called during the callback
        if (!unsubscribed) {
          createSubscription();
        }
      });
      // remove the event listener and unsubscribe from the latest request on unsubscribe
      return () => {
        unsubscribed = true;
        off();
        subscription.unsubscribe();
      };
    });
  }
}
