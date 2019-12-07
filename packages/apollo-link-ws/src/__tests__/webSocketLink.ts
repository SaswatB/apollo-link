import { SubscriptionClient } from 'subscriptions-transport-ws';
import { Observable, execute } from 'apollo-link';
import { ExecutionResult } from 'graphql';

import { WebSocketLink } from '../webSocketLink';

const query = `
  query SampleQuery {
    stub {
      id
    }
  }
`;

const mutation = `
  mutation SampleMutation {
    stub {
      id
    }
  }
`;

const subscription = `
  subscription SampleSubscription {
    stub {
      id
    }
  }
`;

describe('WebSocketLink', () => {
  it('constructs', () => {
    const client: any = {};
    client.__proto__ = SubscriptionClient.prototype;
    expect(() => new WebSocketLink(client)).not.toThrow();
  });

  // TODO some sort of dependency injection

  // it('should pass the correct initialization parameters to the Subscription Client', () => {
  // });

  it('should call request on the client for a query', done => {
    const result = { data: { data: 'result' } };
    const client: any = {};
    const observable = Observable.of(result);
    client.__proto__ = SubscriptionClient.prototype;
    client.request = jest.fn();
    client.request.mockReturnValueOnce(observable);
    client.onReconnected = () => () => {};
    const link = new WebSocketLink(client);

    const obs = execute(link, { query });
    obs.subscribe(data => {
      expect(data).toEqual(result);
      expect(client.request).toHaveBeenCalledTimes(1);
      done();
    });
  });

  it('should call query on the client for a mutation', done => {
    const result = { data: { data: 'result' } };
    const client: any = {};
    const observable = Observable.of(result);
    client.__proto__ = SubscriptionClient.prototype;
    client.request = jest.fn();
    client.request.mockReturnValueOnce(observable);
    client.onReconnected = () => () => {};
    const link = new WebSocketLink(client);

    const obs = execute(link, { query: mutation });
    obs.subscribe(data => {
      expect(data).toEqual(result);
      expect(client.request).toHaveBeenCalledTimes(1);
      done();
    });
  });

  it('should call request on the subscriptions client for subscription', done => {
    const result = { data: { data: 'result' } };
    const client: any = {};
    const observable = Observable.of(result);
    client.__proto__ = SubscriptionClient.prototype;
    client.request = jest.fn();
    client.request.mockReturnValueOnce(observable);
    client.onReconnected = () => () => {};
    const link = new WebSocketLink(client);

    const obs = execute(link, { query: mutation });
    obs.subscribe(data => {
      expect(data).toEqual(result);
      expect(client.request).toHaveBeenCalledTimes(1);
      done();
    });
  });

  it('should call next with multiple results for subscription', done => {
    const results = [
      { data: { data: 'result1' } },
      { data: { data: 'result2' } },
    ];
    const client: any = {};
    client.__proto__ = SubscriptionClient.prototype;
    client.request = jest.fn(() => {
      const copy = [...results];
      return new Observable<ExecutionResult>(observer => {
        observer.next(copy[0]);
        observer.next(copy[1]);
      });
    });
    client.onReconnected = () => () => {};

    const link = new WebSocketLink(client);

    execute(link, { query: subscription }).subscribe(data => {
      expect(client.request).toHaveBeenCalledTimes(1);
      expect(data).toEqual(results.shift());
      if (results.length === 0) {
        done();
      }
    });
  });

  it('should call next with transport reconnect', done => {
    const results = [
      { data: { data: 'result1' } },
      { data: { data: 'result2' } },
    ];
    const client: any = {};
    client.__proto__ = SubscriptionClient.prototype;
    client.request = jest.fn();
    results.forEach(result =>
      client.request.mockReturnValueOnce(Observable.of(result)),
    );
    client.onReconnected = jest.fn(() => () => {});

    const onReconnect = jest.fn();
    const link = new WebSocketLink(client);

    execute(link, { query: subscription, context: { onReconnect } }).subscribe(
      data => {
        expect(data).toEqual(results.shift());
        if (results.length === 1) {
          expect(client.request).toHaveBeenCalledTimes(1);
          client.onReconnected.mock.calls[0][0]();
        } else if (results.length === 0) {
          expect(client.request).toHaveBeenCalledTimes(2);
          expect(onReconnect).toHaveBeenCalledTimes(1);
          done();
        }
      },
    );
  });

  it('should call next with transport reconnect and no reconnect callback', done => {
    const results = [
      { data: { data: 'result1' } },
      { data: { data: 'result2' } },
    ];
    const client: any = {};
    client.__proto__ = SubscriptionClient.prototype;
    client.request = jest.fn();
    results.forEach(result =>
      client.request.mockReturnValueOnce(Observable.of(result)),
    );
    client.onReconnected = jest.fn(() => () => {});

    const link = new WebSocketLink(client);

    execute(link, { query: subscription }).subscribe(data => {
      expect(data).toEqual(results.shift());
      if (results.length === 1) {
        expect(client.request).toHaveBeenCalledTimes(1);
        client.onReconnected.mock.calls[0][0]();
      } else if (results.length === 0) {
        expect(client.request).toHaveBeenCalledTimes(2);
        done();
      }
    });
  });

  it('should not resubscribe on transport reconnect if unsubscribed during reconnect callback', done => {
    const results = [
      { data: { data: 'result1' } },
      { data: { data: 'result2' } },
    ];
    const client: any = {};
    client.__proto__ = SubscriptionClient.prototype;
    client.request = jest.fn();
    results.forEach(result =>
      client.request.mockReturnValueOnce(Observable.of(result)),
    );
    const onReconnectedOff = jest.fn();
    client.onReconnected = jest.fn();
    client.onReconnected.mockReturnValue(onReconnectedOff);

    let requestSubscription;
    const onReconnect = jest.fn(() => {
      requestSubscription.unsubscribe();
      setTimeout(() => {
        expect(client.request).toHaveBeenCalledTimes(1);
        expect(onReconnect).toHaveBeenCalledTimes(1);
        expect(onReconnectedOff).toHaveBeenCalledTimes(1);
        done();
      }, 100);
    });
    const link = new WebSocketLink(client);

    requestSubscription = execute(link, {
      query: subscription,
      context: { onReconnect },
    }).subscribe(data => {
      expect(data).toEqual(results.shift());
      expect(results.length).toEqual(1);
      expect(client.request).toHaveBeenCalledTimes(1);
      client.onReconnected.mock.calls[0][0]();
    });
  });
});
