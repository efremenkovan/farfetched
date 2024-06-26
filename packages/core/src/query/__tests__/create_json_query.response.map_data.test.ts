import { allSettled, createStore, fork } from 'effector';
import { describe, test, expect, vi } from 'vitest';

import { unknownContract } from '../../contract/unknown_contract';
import { createJsonQuery } from '../create_json_query';
import { declareParams } from '../../remote_operation/params';
import { Contract } from '../../contract/type';
import { fetchFx } from '../../fetch/fetch';

describe('remote_data/query/json.response.map_data', () => {
  // Does not matter
  const validStringContract: Contract<unknown, string> = {
    isData: (raw): raw is string => true,

    getErrorMessages: () => [],
  };

  // Does not matter
  const request = {
    url: 'http://api.salo.com',
    method: 'GET' as const,
  };

  test('save data from response as is without callback', async () => {
    const response = Symbol('response');

    const query = createJsonQuery({
      request,
      response: { contract: validStringContract },
    });

    const fetchMock = vi.fn(() => response);

    const scope = fork({ handlers: [[query.__.executeFx, fetchMock]] });

    await allSettled(query.start, { scope });

    expect(scope.getState(query.$data)).toBe(response);
  });

  test('save transformed data with simple callback', async () => {
    const response = Symbol('response');
    const transformed = Symbol('transformed');

    const query = createJsonQuery({
      request,
      response: {
        contract: unknownContract,
        mapData: ({ result, params }) => {
          expect(result).toBe(response);
          expect(params).toBe('caller params');

          return transformed;
        },
      },
      params: declareParams<string>(),
    });

    const fetchMock = vi.fn(() => response);

    const scope = fork({ handlers: [[query.__.executeFx, fetchMock]] });

    await allSettled(query.start, { scope, params: 'caller params' });

    expect(scope.getState(query.$data)).toBe(transformed);
  });

  test('save transformed data with sourced callback', async () => {
    const response = Symbol('response');
    const transformed = Symbol('transformed');

    const $source = createStore('first');

    const query = createJsonQuery({
      request,
      response: {
        contract: unknownContract,
        mapData: {
          source: $source,
          fn: ({ result }, source) => {
            expect(result).toBe(response);
            expect(source).toBe('first');

            return transformed;
          },
        },
      },
    });

    const fetchMock = vi.fn(() => response);

    const scope = fork({ handlers: [[query.__.executeFx, fetchMock]] });

    await allSettled(query.start, { scope });

    expect(scope.getState(query.$data)).toBe(transformed);
  });

  test('`meta` parameter is passed to callback', async () => {
    const response = new Response(null, {
      headers: { 'content-type': 'application/json' },
    });

    const fetchMock = vi.fn(() => response);
    const listener = vi.fn();

    const query = createJsonQuery({
      request,
      response: {
        contract: unknownContract,
        mapData: listener,
      },
    });

    const scope = fork({ handlers: [[fetchFx, fetchMock]] });

    await allSettled(query.start, { scope });

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        meta: { headers: { 'content-type': 'application/json' } },
      })
    );
  });
});
