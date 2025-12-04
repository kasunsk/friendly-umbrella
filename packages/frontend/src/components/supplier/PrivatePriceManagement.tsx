'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';

interface Company {
  id: string;
  name: string;
  email: string;
}

interface PrivatePrice {
  id: string;
  companyId: string;
  company: {
    id: string;
    name: string;
    email: string;
  };
  price: number | string;
  currency: string;
  effectiveFrom: string;
  effectiveUntil: string | null;
  isActive: boolean;
  notes: string | null;
}

interface PrivatePriceManagementProps {
  productId: string;
  productName: string;
  defaultCurrency?: string;
  onClose: () => void;
  onUpdate: () => void;
}

export function PrivatePriceManagement({
  productId,
  productName,
  defaultCurrency = 'USD',
  onClose,
  onUpdate,
}: PrivatePriceManagementProps) {
  const [privatePrices, setPrivatePrices] = useState<PrivatePrice[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingPrice, setEditingPrice] = useState<PrivatePrice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    companyId: '',
    price: '',
    currency: defaultCurrency,
    notes: '',
  });

  useEffect(() => {
    loadPrivatePrices();
    loadCompanies();
  }, [productId]);

  const loadPrivatePrices = async () => {
    try {
      setLoading(true);
      const response = await apiGet<{ privatePrices: PrivatePrice[] }>(
        `/api/v1/products/${productId}/private-prices`
      );
      setPrivatePrices(response.privatePrices || []);
    } catch (err: any) {
      console.error('Failed to load private prices:', err);
      setError(err?.error?.message || 'Failed to load private prices');
    } finally {
      setLoading(false);
    }
  };

  const loadCompanies = async () => {
    try {
      setLoadingCompanies(true);
      const response = await apiGet<{ companies: Company[] }>('/api/v1/companies');
      setCompanies(response.companies || []);
    } catch (err: any) {
      console.error('Failed to load companies:', err);
    } finally {
      setLoadingCompanies(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(null);
    setSuccess(null);
  };

  const handleAdd = () => {
    setShowAddForm(true);
    setEditingPrice(null);
    setFormData({
      companyId: '',
      price: '',
      currency: defaultCurrency,
      notes: '',
    });
    setError(null);
    setSuccess(null);
  };

  const handleEdit = (price: PrivatePrice) => {
    setEditingPrice(price);
    setShowAddForm(true);
    setFormData({
      companyId: price.companyId,
      price: typeof price.price === 'number' ? price.price.toString() : String(price.price),
      currency: price.currency,
      notes: price.notes || '',
    });
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      if (editingPrice) {
        // Update existing private price
        await apiPut(`/api/v1/private-prices/${editingPrice.id}`, {
          price: parseFloat(formData.price),
          currency: formData.currency,
          notes: formData.notes || undefined,
        });
        setSuccess('Private price updated successfully');
      } else {
        // Create new private price
        await apiPost(`/api/v1/products/${productId}/private-prices`, {
          companyId: formData.companyId,
          price: parseFloat(formData.price),
          currency: formData.currency,
          notes: formData.notes || undefined,
        });
        setSuccess('Private price created successfully');
      }

      // Reload prices and notify parent
      await loadPrivatePrices();
      onUpdate();
      
      // Reset form
      setTimeout(() => {
        setShowAddForm(false);
        setEditingPrice(null);
        setFormData({
          companyId: '',
          price: '',
          currency: defaultCurrency,
          notes: '',
        });
        setSuccess(null);
      }, 1500);
    } catch (err: any) {
      setError(err?.error?.message || 'Failed to save private price');
    }
  };

  const handleDelete = async (priceId: string) => {
    if (!confirm('Are you sure you want to delete this private price?')) {
      return;
    }

    try {
      await apiDelete(`/api/v1/private-prices/${priceId}`);
      setSuccess('Private price deleted successfully');
      await loadPrivatePrices();
      onUpdate();
      setTimeout(() => setSuccess(null), 2000);
    } catch (err: any) {
      setError(err?.error?.message || 'Failed to delete private price');
    }
  };

  const getCompanyName = (companyId: string) => {
    const company = companies.find((c) => c.id === companyId);
    return company?.name || 'Unknown Company';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Manage Special Prices</h2>
              <p className="text-sm text-gray-500 mt-1">Product: {productName}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md text-green-700 text-sm">
              {success}
            </div>
          )}

          <div className="mb-4 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">Special Prices for Companies</h3>
            <Button onClick={handleAdd} size="sm">
              Add Special Price
            </Button>
          </div>

          {showAddForm && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="text-md font-semibold text-gray-900 mb-3">
                {editingPrice ? 'Edit Special Price' : 'Add New Special Price'}
              </h4>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="companyId">Company *</Label>
                    <select
                      id="companyId"
                      name="companyId"
                      value={formData.companyId}
                      onChange={handleInputChange}
                      required
                      disabled={!!editingPrice}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">Select a company...</option>
                      {companies.map((company) => (
                        <option key={company.id} value={company.id}>
                          {company.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="currency">Currency *</Label>
                    <select
                      id="currency"
                      name="currency"
                      value={formData.currency}
                      onChange={handleInputChange}
                      required
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                      <option value="SGD">SGD</option>
                    </select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="price">Special Price *</Label>
                  <Input
                    id="price"
                    name="price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={handleInputChange}
                    required
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <textarea
                    id="notes"
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    rows={2}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    placeholder="Additional notes about this special price..."
                  />
                </div>

                <div className="flex justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowAddForm(false);
                      setEditingPrice(null);
                      setFormData({
                        companyId: '',
                        price: '',
                        currency: defaultCurrency,
                        notes: '',
                      });
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingPrice ? 'Update Price' : 'Add Price'}
                  </Button>
                </div>
              </form>
            </div>
          )}

          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
              <p className="mt-2 text-gray-500">Loading private prices...</p>
            </div>
          ) : privatePrices.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No special prices set for this product yet.
              <br />
              Click &quot;Add Special Price&quot; to create one.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Company
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Price
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Currency
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Effective From
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Notes
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {privatePrices.map((price) => (
                    <tr key={price.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {price.company.name}
                        </div>
                        <div className="text-sm text-gray-500">{price.company.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                        {typeof price.price === 'number' ? price.price.toFixed(2) : Number(price.price).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {price.currency}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(price.effectiveFrom).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {price.notes || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(price)}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(price.id)}
                            className="text-red-600 hover:bg-red-50 hover:text-red-700"
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

