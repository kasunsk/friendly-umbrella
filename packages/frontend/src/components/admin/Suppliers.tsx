'use client';

import { useEffect, useState } from 'react';
import { getAllTenants, toggleTenantStatus, Tenant } from '@/lib/adminApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function Suppliers() {
  const [suppliers, setSuppliers] = useState<Tenant[]>([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalSuppliers, setTotalSuppliers] = useState(0);
  const suppliersPerPage = 10;

  useEffect(() => {
    loadSuppliers(currentPage);
  }, [currentPage]);

  useEffect(() => {
    // Filter suppliers by name (case-insensitive) - client-side filtering on current page
    if (!searchTerm.trim()) {
      setFilteredSuppliers(suppliers);
    } else {
      const filtered = suppliers.filter((supplier) =>
        supplier.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredSuppliers(filtered);
    }
  }, [searchTerm, suppliers]);

  const loadSuppliers = async (page = 1) => {
    try {
      setLoading(true);
      const data = await getAllTenants(undefined, 'supplier', page, suppliersPerPage);
      setSuppliers(data.tenants);
      setFilteredSuppliers(data.tenants);
      setCurrentPage(data.pagination.page);
      setTotalPages(data.pagination.totalPages);
      setTotalSuppliers(data.pagination.total);
      setError(null);
    } catch (err: any) {
      setError(err?.error?.message || 'Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (supplierId: string, newStatus: boolean) => {
    // Store previous state for rollback on error
    const previousSuppliers = [...suppliers];
    const previousFiltered = [...filteredSuppliers];
    
    // Optimistically update UI immediately
    setSuppliers((prev) =>
      prev.map((supplier) =>
        supplier.id === supplierId ? { ...supplier, isActive: newStatus } : supplier
      )
    );
    setFilteredSuppliers((prev) =>
      prev.map((supplier) =>
        supplier.id === supplierId ? { ...supplier, isActive: newStatus } : supplier
      )
    );
    
    try {
      setTogglingId(supplierId);
      await toggleTenantStatus(supplierId, newStatus);
    } catch (err: any) {
      // Rollback on error
      setSuppliers(previousSuppliers);
      setFilteredSuppliers(previousFiltered);
      alert(err?.error?.message || 'Failed to toggle supplier status');
    } finally {
      setTogglingId(null);
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
        <h2 className="text-2xl font-bold text-gray-900">Suppliers</h2>
        <Button onClick={() => loadSuppliers(currentPage)} variant="outline">
          Refresh
        </Button>
      </div>

      {/* Search Filter */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <Input
          type="text"
          placeholder="Search suppliers by name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-md"
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {filteredSuppliers.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No suppliers found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchTerm ? 'No suppliers match your search.' : 'No suppliers have been registered yet.'}
          </p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Phone
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Users
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredSuppliers.map((supplier) => (
                <tr key={supplier.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{supplier.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{supplier.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{supplier.phone || '-'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        supplier.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : supplier.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {supplier.status.charAt(0).toUpperCase() + supplier.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {supplier._count?.users || supplier.users.length || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(supplier.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {supplier.status === 'active' && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant={supplier.isActive ? 'default' : 'outline'}
                          onClick={() => handleToggleStatus(supplier.id, true)}
                          disabled={togglingId === supplier.id || supplier.isActive}
                          className={supplier.isActive ? 'bg-green-600 hover:bg-green-700 text-white' : 'text-gray-700'}
                        >
                          Active
                        </Button>
                        <Button
                          size="sm"
                          variant={!supplier.isActive ? 'default' : 'outline'}
                          onClick={() => handleToggleStatus(supplier.id, false)}
                          disabled={togglingId === supplier.id || !supplier.isActive}
                          className={!supplier.isActive ? 'bg-gray-600 hover:bg-gray-700 text-white' : 'text-gray-700'}
                        >
                          Inactive
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between px-6 py-4 border-t border-gray-200">
            <div className="text-sm text-gray-500">
              Showing {suppliers.length > 0 ? ((currentPage - 1) * suppliersPerPage + 1) : 0} to {Math.min(currentPage * suppliersPerPage, totalSuppliers)} of {totalSuppliers} suppliers
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const newPage = currentPage - 1;
                  setCurrentPage(newPage);
                }}
                disabled={currentPage === 1 || loading}
              >
                Previous
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCurrentPage(pageNum)}
                      disabled={loading}
                      className="min-w-[40px]"
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const newPage = currentPage + 1;
                  setCurrentPage(newPage);
                }}
                disabled={currentPage === totalPages || loading}
              >
                Next
              </Button>
            </div>
          </div>
          )}
        </>
      )}
    </div>
  );
}

