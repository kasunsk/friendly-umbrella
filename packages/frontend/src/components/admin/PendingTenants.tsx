'use client';

import { useEffect, useState } from 'react';
import { getPendingTenants, approveTenant, Tenant } from '@/lib/adminApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function PendingTenants() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    loadPendingTenants();
  }, []);

  const loadPendingTenants = async () => {
    try {
      setLoading(true);
      const data = await getPendingTenants();
      setTenants(data.tenants);
      setError(null);
    } catch (err: any) {
      setError(err.error?.message || 'Failed to load pending tenants');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (tenantId: string) => {
    try {
      setProcessingId(tenantId);
      await approveTenant(tenantId, true);
      await loadPendingTenants(); // Refresh list
      setError(null);
    } catch (err: any) {
      setError(err.error?.message || 'Failed to approve tenant');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (tenantId: string) => {
    try {
      setProcessingId(tenantId);
      await approveTenant(tenantId, false, rejectReason);
      await loadPendingTenants(); // Refresh list
      setShowRejectModal(null);
      setRejectReason('');
      setError(null);
    } catch (err: any) {
      setError(err.error?.message || 'Failed to reject tenant');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Pending Tenant Requests</h2>
        <Button onClick={loadPendingTenants} variant="outline">
          Refresh
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {tenants.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No pending requests</h3>
          <p className="mt-1 text-sm text-gray-500">All tenant requests have been processed.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {tenants.map((tenant) => (
            <div key={tenant.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{tenant.name}</h3>
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded ${
                        tenant.type === 'supplier'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {tenant.type.charAt(0).toUpperCase() + tenant.type.slice(1)}
                    </span>
                    <span className="px-2 py-1 text-xs font-medium rounded bg-yellow-100 text-yellow-800">
                      Pending
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-4 text-sm text-gray-600">
                    <div>
                      <span className="font-medium">Email:</span> {tenant.email}
                    </div>
                    {tenant.phone && (
                      <div>
                        <span className="font-medium">Phone:</span> {tenant.phone}
                      </div>
                    )}
                    {tenant.address && (
                      <div className="col-span-2">
                        <span className="font-medium">Address:</span> {tenant.address}
                      </div>
                    )}
                    {tenant.users.length > 0 && (
                      <div className="col-span-2">
                        <span className="font-medium">Admin User:</span>{' '}
                        {tenant.users[0].firstName} {tenant.users[0].lastName} ({tenant.users[0].email})
                      </div>
                    )}
                    <div>
                      <span className="font-medium">Requested:</span>{' '}
                      {new Date(tenant.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 ml-4">
                  <Button
                    onClick={() => handleApprove(tenant.id)}
                    disabled={processingId === tenant.id}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {processingId === tenant.id ? 'Processing...' : 'Approve'}
                  </Button>
                  <Button
                    onClick={() => setShowRejectModal(tenant.id)}
                    disabled={processingId === tenant.id}
                    variant="outline"
                    className="border-red-300 text-red-700 hover:bg-red-50"
                  >
                    Reject
                  </Button>
                </div>
              </div>

              {/* Reject Modal */}
              {showRejectModal === tenant.id && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
                  <Label htmlFor={`reason-${tenant.id}`}>Rejection Reason (Optional)</Label>
                  <Input
                    id={`reason-${tenant.id}`}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Enter reason for rejection..."
                    className="mt-2"
                  />
                  <div className="flex gap-2 mt-4">
                    <Button
                      onClick={() => handleReject(tenant.id)}
                      disabled={processingId === tenant.id}
                      variant="outline"
                      className="border-red-300 text-red-700 hover:bg-red-50"
                    >
                      Confirm Reject
                    </Button>
                    <Button
                      onClick={() => {
                        setShowRejectModal(null);
                        setRejectReason('');
                      }}
                      variant="outline"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

