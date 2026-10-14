import type { ISpendRequestResource } from '@stripe/link-sdk';
import { expect, it, vi } from 'vitest';
import type { CliAuthStorage } from '../../../auth/storage';
import { createSpendRequestCli } from '..';

it('approves the supplied test request and returns its status as JSON', async () => {
  const result = { id: 'lsrq_123', status: 'approved' };
  const approveTestRequest = vi.fn().mockResolvedValue(result);
  const repository = { approveTestRequest } as unknown as ISpendRequestResource;
  const cli = createSpendRequestCli(repository, undefined, 'test_token');
  let stdout = '';

  await cli.serve(['approve-test-request', 'lsrq_123', '--format', 'json'], {
    stdout: (text) => {
      stdout += text;
    },
    exit: (code) => {
      expect(code).toBe(0);
    },
  });

  expect(approveTestRequest).toHaveBeenCalledExactlyOnceWith('lsrq_123');
  expect(JSON.parse(stdout)).toEqual(result);
});

it('requires authentication before approving', async () => {
  const approveTestRequest = vi.fn();
  const repository = { approveTestRequest } as unknown as ISpendRequestResource;
  const authStorage = {
    isAuthenticated: () => false,
  } as unknown as CliAuthStorage;
  const cli = createSpendRequestCli(repository, authStorage);
  let stdout = '';

  await cli.serve(['approve-test-request', 'lsrq_123', '--format', 'json'], {
    stdout: (text) => {
      stdout += text;
    },
    exit: (code) => {
      expect(code).toBe(1);
    },
  });

  expect(JSON.parse(stdout).code).toBe('NOT_AUTHENTICATED');
  expect(approveTestRequest).not.toHaveBeenCalled();
});
