'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { apiGet } from '@/lib/api';
import Link from 'next/link';

interface SearchProduct {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  category: string | null;
  unit: string;
  supplierId: string;
  supplierName: string;
  price: number | null;
  priceType: 'default' | 'private' | null;
  currency: string | null;
  defaultPrice: {
    price: number;
    currency: string;
  } | null;
  privatePrice: {
    price: number | null;
    discountPercentage: number | null;
    calculatedPrice: number | null;
    currency: string;
  } | null;
}

interface SupplierInfo {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
}

export default function CompanyDashboardPage() {
  return (
    <ProtectedRoute requireTenantType="company">
      <DashboardContent />
    </ProtectedRoute>
  );
}

function DashboardContent() {
  const { user, logout } = useAuth();
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [supplierInfo, setSupplierInfo] = useState<Map<string, SupplierInfo>>(new Map());
  const [isLoadingSupplier, setIsLoadingSupplier] = useState<Map<string, boolean>>(new Map());
  
  // Product listing and filtering
  const [allProducts, setAllProducts] = useState<SearchProduct[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [filteredProducts, setFilteredProducts] = useState<SearchProduct[]>([]);
  const [filters, setFilters] = useState({
    supplierId: '',
    category: '',
    search: '',
  });
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const productsPerPage = 10;
  
  // Searchable dropdown states
  const [supplierDropdownOpen, setSupplierDropdownOpen] = useState(false);
  const [supplierSearchQuery, setSupplierSearchQuery] = useState('');
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');

  // Load products with filters
  const loadProducts = useCallback(async (page = 1) => {
    setIsLoadingProducts(true);
    const params = new URLSearchParams();
    if (filters.search) {
      params.append('q', filters.search);
    }
    if (filters.supplierId) {
      params.append('supplierId', filters.supplierId);
    }
    if (filters.category) {
      params.append('category', filters.category);
    }
    params.append('page', page.toString());
    params.append('limit', productsPerPage.toString());

    try {
      const response = await apiGet<{ products: SearchProduct[]; pagination: { page: number; totalPages: number; total: number } }>(
        `/api/v1/products/search?${params.toString()}`
      );
      
      // Sort products: those with special prices first
      const sortedProducts = [...response.products].sort((a, b) => {
        const aHasSpecialPrice = a.privatePrice !== null && (a.privatePrice.price !== null || a.privatePrice.calculatedPrice !== null);
        const bHasSpecialPrice = b.privatePrice !== null && (b.privatePrice.price !== null || b.privatePrice.calculatedPrice !== null);
        
        if (aHasSpecialPrice && !bHasSpecialPrice) return -1;
        if (!aHasSpecialPrice && bHasSpecialPrice) return 1;
        return 0; // Keep original order if both have or both don't have special prices
      });
      
      setAllProducts(sortedProducts);
      setFilteredProducts(sortedProducts);
      setCurrentPage(response.pagination.page);
      setTotalPages(response.pagination.totalPages);
    } catch (error: any) {
      console.error('Failed to load products:', error);
      console.error('Error details:', {
        message: error?.error?.message || error?.message,
        statusCode: error?.error?.statusCode || error?.status,
        endpoint: `/api/v1/products/search?${params.toString()}`,
      });
      setAllProducts([]);
      setFilteredProducts([]);
    } finally {
      setIsLoadingProducts(false);
    }
  }, [filters.search, filters.supplierId, filters.category]);

  // Load suppliers and categories on mount
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // Load suppliers
        const suppliersResponse = await apiGet<{ suppliers: Array<{ id: string; name: string }> }>('/api/v1/suppliers');
        setSuppliers(suppliersResponse.suppliers);

        // Load categories
        const categoriesResponse = await apiGet<{ categories: string[] }>('/api/v1/products/categories');
        setCategories(categoriesResponse.categories);
      } catch (error: any) {
        console.error('Failed to load initial data:', error);
        console.error('Error details:', {
          message: error?.error?.message || error?.message,
          statusCode: error?.error?.statusCode || error?.status,
        });
      }
    };

    loadInitialData();
  }, []);

  // Load products when filters change or on initial mount
  useEffect(() => {
    loadProducts(1);
  }, [loadProducts]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.supplier-dropdown-container') && !target.closest('.category-dropdown-container')) {
        setSupplierDropdownOpen(false);
        setCategoryDropdownOpen(false);
      }
    };

    if (supplierDropdownOpen || categoryDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [supplierDropdownOpen, categoryDropdownOpen]);


  // Handle filter changes
  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  // Fetch supplier information (phone and address)
  const fetchSupplierInfo = async (product: SearchProduct) => {
    const productKey = `${product.id}-${product.supplierId}`;
    setIsLoadingSupplier((prev) => new Map(prev).set(productKey, true));
    try {
      // Fetch supplier details including phone and address
      const response = await apiGet<{ supplier: SupplierInfo }>(
        `/api/v1/suppliers/${product.supplierId}`
      );
      
      setSupplierInfo((prev) => {
        const newMap = new Map(prev);
        newMap.set(productKey, response.supplier);
        return newMap;
      });
    } catch (error) {
      console.error('Failed to fetch supplier info:', error);
      setSupplierInfo((prev) => {
        const newMap = new Map(prev);
        // Set with at least the name we know
        newMap.set(productKey, {
          id: product.supplierId,
          name: product.supplierName,
          phone: null,
          address: null,
        });
        return newMap;
      });
    } finally {
      setIsLoadingSupplier((prev) => {
        const newMap = new Map(prev);
        newMap.set(productKey, false);
        return newMap;
      });
    }
  };

  const handleProductSelect = (product: SearchProduct) => {
    const productKey = `${product.id}-${product.supplierId}`;
    
    // Toggle expansion
    if (expandedProductId === productKey) {
      // Collapse
      setExpandedProductId(null);
    } else {
      // Expand
      setExpandedProductId(productKey);
      
      // Fetch supplier info if not already loaded
      if (!supplierInfo.has(productKey)) {
        fetchSupplierInfo(product);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Price Tracker
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                {user?.tenant?.name}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {user?.role === 'company_admin' && (
                <Link href="/company/users">
                  <Button variant="outline">User Management</Button>
                </Link>
              )}
              <Button onClick={logout} variant="outline">
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Product Filters */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Browse Products</h2>
            <Button
              variant="outline"
              onClick={() => {
                setFilters({ supplierId: '', category: '', search: '' });
                setSupplierSearchQuery('');
                setCategorySearchQuery('');
                setSupplierDropdownOpen(false);
                setCategoryDropdownOpen(false);
              }}
            >
              Clear Filters
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative supplier-dropdown-container">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Supplier
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search or select supplier..."
                  value={supplierDropdownOpen ? supplierSearchQuery : (filters.supplierId ? suppliers.find(s => s.id === filters.supplierId)?.name || '' : '')}
                  onChange={(e) => {
                    setSupplierSearchQuery(e.target.value);
                    if (!supplierDropdownOpen) setSupplierDropdownOpen(true);
                  }}
                  onFocus={() => {
                    setSupplierDropdownOpen(true);
                    setSupplierSearchQuery('');
                  }}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <button
                  type="button"
                  onClick={() => {
                    setSupplierDropdownOpen(!supplierDropdownOpen);
                    if (!supplierDropdownOpen) setSupplierSearchQuery('');
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={supplierDropdownOpen ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
                  </svg>
                </button>
                {supplierDropdownOpen && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                    <div
                      className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                      onClick={() => {
                        handleFilterChange('supplierId', '');
                        setSupplierSearchQuery('');
                        setSupplierDropdownOpen(false);
                      }}
                    >
                      All Suppliers
                    </div>
                    {suppliers
                      .filter(supplier =>
                        supplier.name.toLowerCase().includes(supplierSearchQuery.toLowerCase())
                      )
                      .map((supplier) => (
                        <div
                          key={supplier.id}
                          className={`px-4 py-2 hover:bg-gray-100 cursor-pointer ${
                            filters.supplierId === supplier.id ? 'bg-blue-50' : ''
                          }`}
                          onClick={() => {
                            handleFilterChange('supplierId', supplier.id);
                            setSupplierSearchQuery('');
                            setSupplierDropdownOpen(false);
                          }}
                        >
                          {supplier.name}
                        </div>
                      ))}
                    {suppliers.filter(supplier =>
                      supplier.name.toLowerCase().includes(supplierSearchQuery.toLowerCase())
                    ).length === 0 && supplierSearchQuery && (
                      <div className="px-4 py-2 text-gray-500 text-sm">
                        No suppliers found
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            <div className="relative category-dropdown-container">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Category
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search or select category..."
                  value={categoryDropdownOpen ? categorySearchQuery : filters.category}
                  onChange={(e) => {
                    setCategorySearchQuery(e.target.value);
                    if (!categoryDropdownOpen) setCategoryDropdownOpen(true);
                  }}
                  onFocus={() => {
                    setCategoryDropdownOpen(true);
                    setCategorySearchQuery('');
                  }}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <button
                  type="button"
                  onClick={() => {
                    setCategoryDropdownOpen(!categoryDropdownOpen);
                    if (!categoryDropdownOpen) setCategorySearchQuery('');
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={categoryDropdownOpen ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
                  </svg>
                </button>
                {categoryDropdownOpen && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                    <div
                      className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                      onClick={() => {
                        handleFilterChange('category', '');
                        setCategorySearchQuery('');
                        setCategoryDropdownOpen(false);
                      }}
                    >
                      All Categories
                    </div>
                    {categories
                      .filter(category =>
                        category.toLowerCase().includes(categorySearchQuery.toLowerCase())
                      )
                      .map((category) => (
                        <div
                          key={category}
                          className={`px-4 py-2 hover:bg-gray-100 cursor-pointer ${
                            filters.category === category ? 'bg-blue-50' : ''
                          }`}
                          onClick={() => {
                            handleFilterChange('category', category);
                            setCategorySearchQuery('');
                            setCategoryDropdownOpen(false);
                          }}
                        >
                          {category}
                        </div>
                      ))}
                    {categories.filter(category =>
                      category.toLowerCase().includes(categorySearchQuery.toLowerCase())
                    ).length === 0 && categorySearchQuery && (
                      <div className="px-4 py-2 text-gray-500 text-sm">
                        No categories found
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search by Product Name
              </label>
              <input
                type="text"
                placeholder="Search by product name..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
        </div>

        {/* Products List */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Available Products
              {filteredProducts.length > 0 && (
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({filteredProducts.length} {filteredProducts.length === 1 ? 'product' : 'products'})
                </span>
              )}
            </h2>
          </div>

          {isLoadingProducts ? (
            <div className="text-center py-8">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
              <p className="mt-2 text-gray-500">Loading products...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {filters.supplierId || filters.category || filters.search
                ? 'No products match your filters. Try adjusting your filters.'
                : 'No products available yet. Suppliers need to add products with default prices.'}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Product
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Supplier
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Category
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Unit
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Price
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredProducts.map((product) => {
                      const productKey = `${product.id}-${product.supplierId}`;
                      const isExpanded = expandedProductId === productKey;
                      const supplier = supplierInfo.get(productKey);
                      const loading = isLoadingSupplier.get(productKey) || false;

                      return (
                        <React.Fragment key={productKey}>
                          <tr className="hover:bg-gray-50">
                            <td className="px-6 py-4">
                              <div className="text-sm font-medium text-gray-900">{product.name}</div>
                              <div className="text-sm text-gray-500">SKU: {product.sku}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {product.supplierName}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {product.category || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {product.unit}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {product.defaultPrice || product.privatePrice ? (
                                <div className="space-y-1">
                                  {/* Default Price */}
                                  {product.defaultPrice && (
                                    <div>
                                      <div className="text-sm text-gray-600">
                                        Default: {product.defaultPrice.currency} {product.defaultPrice.price.toFixed(2)}
                                      </div>
                                    </div>
                                  )}
                                  {/* Special Price */}
                                  {product.privatePrice && (
                                    <div>
                                      {product.privatePrice.discountPercentage !== null && product.privatePrice.calculatedPrice !== null ? (
                                        // Discount percentage applied
                                        <>
                                          <div className="text-sm font-semibold text-green-600">
                                            Your Price: {product.privatePrice.currency} {product.privatePrice.calculatedPrice.toFixed(2)}
                                          </div>
                                          <div className="text-xs text-green-600 font-medium">
                                            {product.privatePrice.discountPercentage.toFixed(1)}% Discount Applied
                                          </div>
                                          {product.defaultPrice && (
                                            <div className="text-xs text-green-600">
                                              {(((product.defaultPrice.price - product.privatePrice.calculatedPrice) / product.defaultPrice.price) * 100).toFixed(1)}% savings
                                            </div>
                                          )}
                                        </>
                                      ) : product.privatePrice.price !== null ? (
                                        // Fixed special price
                                        <>
                                          <div className="text-sm font-semibold text-green-600">
                                            Your Price: {product.privatePrice.currency} {product.privatePrice.price.toFixed(2)}
                                          </div>
                                          {product.defaultPrice && (
                                            <div className="text-xs text-green-600">
                                              {(((product.defaultPrice.price - product.privatePrice.price) / product.defaultPrice.price) * 100).toFixed(1)}% savings
                                            </div>
                                          )}
                                        </>
                                      ) : null}
                                    </div>
                                  )}
                                  {/* Show only default if no special price */}
                                  {!product.privatePrice && product.defaultPrice && (
                                    <div className="text-xs text-gray-400">No special rate</div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-sm text-gray-400">No price</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleProductSelect(product)}
                              >
                                {isExpanded ? 'Hide Details' : 'View Details'}
                              </Button>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr key={`${product.id}-${product.supplierId}-expanded`}>
                              <td colSpan={6} className="px-6 py-4 bg-gray-50">
                                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                                  <div className="mb-4">
                                    <h3 className="text-lg font-semibold text-gray-900">Supplier Information</h3>
                                    <p className="text-sm text-gray-500">
                                      Contact details for {product.supplierName}
                                    </p>
                                  </div>

                                  {loading ? (
                                    <div className="text-center py-8">
                                      <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
                                      <p className="mt-2 text-gray-500">Loading supplier information...</p>
                                    </div>
                                  ) : supplier ? (
                                    <div className="space-y-4">
                                      <div className="flex items-start">
                                        <div className="flex-shrink-0">
                                          <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                          </svg>
                                        </div>
                                        <div className="ml-3">
                                          <p className="text-sm font-medium text-gray-500">Phone Number</p>
                                          <p className="text-sm text-gray-900 mt-1">
                                            {supplier.phone || <span className="text-gray-400">Not available</span>}
                                          </p>
                                        </div>
                                      </div>
                                      
                                      <div className="flex items-start">
                                        <div className="flex-shrink-0">
                                          <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                          </svg>
                                        </div>
                                        <div className="ml-3">
                                          <p className="text-sm font-medium text-gray-500">Location</p>
                                          <p className="text-sm text-gray-900 mt-1">
                                            {supplier.address || <span className="text-gray-400">Not available</span>}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="text-center py-8 text-gray-500">
                                      Supplier information not available
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm text-gray-500">
                    Page {currentPage} of {totalPages}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadProducts(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadProducts(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

      </main>
    </div>
  );
}


