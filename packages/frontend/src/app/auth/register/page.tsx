'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { getActiveTenants, Tenant } from '@/lib/tenantApi';
import { apiPost } from '@/lib/api';
import { useRouter } from 'next/navigation';

type RegistrationType = 'new_company' | 'new_supplier' | 'new_company_user' | 'new_supplier_user';

interface RegisterFormData {
  registrationType: RegistrationType;
  tenantName?: string;
  tenantType?: 'supplier' | 'company';
  tenantId?: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  address?: string;
  postalCode?: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [registrationType, setRegistrationType] = useState<RegistrationType>('new_company');
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loadingTenants, setLoadingTenants] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors },
    reset,
  } = useForm<RegisterFormData>({
    defaultValues: {
      registrationType: 'new_company',
    },
  });

  const selectedType = watch('registrationType') || 'new_company';
  const selectedTenantId = watch('tenantId');

  useEffect(() => {
    setRegistrationType(selectedType as RegistrationType);
  }, [selectedType]);

  // Load tenants when registration type requires it
  useEffect(() => {
    if (selectedType === 'new_company_user' || selectedType === 'new_supplier_user') {
      loadTenants();
    }
  }, [selectedType]);

  const loadTenants = async () => {
    try {
      setLoadingTenants(true);
      const tenantType = selectedType === 'new_company_user' ? 'company' : 'supplier';
      const data = await getActiveTenants(tenantType);
      setTenants(data.tenants);
    } catch (err: any) {
      console.error('Failed to load tenants:', err);
      setError('Failed to load companies/suppliers. Please try again.');
    } finally {
      setLoadingTenants(false);
    }
  };

  const onSubmit = async (data: RegisterFormData) => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      // Validate registration type is present
      if (!data.registrationType) {
        setError('Please select a registration type');
        setLoading(false);
        return;
      }

      // Prepare registration payload
      const payload: any = {
        registrationType: data.registrationType,
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
      };

      if (data.registrationType === 'new_company' || data.registrationType === 'new_supplier') {
        if (!data.tenantName) {
          setError('Company/Supplier name is required');
          setLoading(false);
          return;
        }
        if (!data.phone) {
          setError('Phone number is required');
          setLoading(false);
          return;
        }
        if (!data.address) {
          setError('Address is required');
          setLoading(false);
          return;
        }
        if (!data.postalCode) {
          setError('Postal code is required');
          setLoading(false);
          return;
        }
        payload.tenantName = data.tenantName;
        payload.tenantType = data.registrationType === 'new_company' ? 'company' : 'supplier';
        payload.phone = data.phone;
        payload.address = data.address;
        payload.postalCode = data.postalCode;
      } else {
        if (!data.tenantId) {
          setError('Please select a company or supplier');
          setLoading(false);
          return;
        }
        payload.tenantId = data.tenantId;
      }

      console.log('Registration payload:', { ...payload, password: '***' });

      const response = await apiPost<any>('/api/v1/auth/register', payload);

      setSuccess(response.message || 'Registration successful! Your account is pending approval.');
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push('/auth/login?pending=true');
      }, 3000);
    } catch (err: any) {
      console.error('Registration error:', err);
      
      // Handle validation errors from express-validator or Zod
      if (err?.errors && Array.isArray(err.errors)) {
        const errorMessages = err.errors.map((e: any) => e.msg || e.message || `${e.path}: ${e.message || e.msg}`).join(', ');
        setError(errorMessages || 'Validation failed. Please check your input.');
      } else if (err?.error?.errors && Array.isArray(err.error.errors)) {
        const errorMessages = err.error.errors.map((e: any) => e.msg || e.message || `${e.path}: ${e.message || e.msg}`).join(', ');
        setError(errorMessages || 'Validation failed. Please check your input.');
      } else {
        setError(err?.error?.message || err?.message || 'Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
            Create your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Or{' '}
            <Link
              href="/auth/login"
              className="font-medium text-primary hover:text-primary/80"
            >
              sign in to existing account
            </Link>
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {success && (
            <div className="rounded-md bg-green-50 p-4">
              <p className="text-sm text-green-800">{success}</p>
            </div>
          )}

          <div className="space-y-4 rounded-md shadow-sm">
            {/* Registration Type Selection */}
            <div>
              <Label htmlFor="registrationType">Registration Type *</Label>
              <select
                id="registrationType"
                {...register('registrationType', { 
                  required: 'Registration type is required',
                  validate: (value) => {
                    const validTypes = ['new_company', 'new_supplier', 'new_company_user', 'new_supplier_user'];
                    if (!validTypes.includes(value)) {
                      return 'Please select a valid registration type';
                    }
                    return true;
                  }
                })}
                value={selectedType}
                onChange={(e) => {
                  const value = e.target.value as RegistrationType;
                  setValue('registrationType', value);
                  setRegistrationType(value);
                  // Clear phone, address, and postal code when switching registration types
                  if (value !== 'new_company' && value !== 'new_supplier') {
                    setValue('phone', '');
                    setValue('address', '');
                    setValue('postalCode', '');
                  }
                }}
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="new_company">New Company Registration</option>
                <option value="new_supplier">New Supplier Registration</option>
                <option value="new_company_user">New User for a Company</option>
                <option value="new_supplier_user">New User for a Supplier</option>
              </select>
              {errors.registrationType && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.registrationType.message}
                </p>
              )}
            </div>

            {/* Show tenant name for new company/supplier */}
            {(registrationType === 'new_company' || registrationType === 'new_supplier') && (
              <>
                <div>
                  <Label htmlFor="tenantName">
                    {registrationType === 'new_supplier' ? 'Supplier Name *' : 'Company Name *'}
                  </Label>
                  <Input
                    id="tenantName"
                    type="text"
                    {...register('tenantName', { required: true })}
                    className="mt-1"
                    placeholder={
                      registrationType === 'new_supplier'
                        ? 'Your supplier business name'
                        : 'Your company name'
                    }
                  />
                  {errors.tenantName && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.tenantName.message || 'This field is required'}
                    </p>
                  )}
                </div>
                <input
                  type="hidden"
                  {...register('tenantType', { 
                    value: registrationType === 'new_supplier' ? 'supplier' : 'company'
                  })}
                />
                
                <div>
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    {...register('phone', { required: 'Phone number is required' })}
                    className="mt-1"
                    placeholder="e.g., +65 1234 5678"
                  />
                  {errors.phone && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.phone.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="address">Address *</Label>
                  <textarea
                    id="address"
                    {...register('address', { required: 'Address is required' })}
                    className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    rows={3}
                    placeholder="Enter your business address..."
                  />
                  {errors.address && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.address.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="postalCode">Postal Code *</Label>
                  <Input
                    id="postalCode"
                    type="text"
                    {...register('postalCode', { 
                      required: 'Postal code is required',
                      pattern: {
                        value: /^[A-Z0-9\s-]{3,20}$/i,
                        message: 'Please enter a valid postal code',
                      },
                    })}
                    className="mt-1"
                    placeholder="e.g., 12345 or S123456"
                  />
                  {errors.postalCode && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.postalCode.message}
                    </p>
                  )}
                </div>
              </>
            )}

            {/* Show tenant selection for new user */}
            {(registrationType === 'new_company_user' || registrationType === 'new_supplier_user') && (
              <div>
                <Label htmlFor="tenantId">
                  Select {registrationType === 'new_company_user' ? 'Company' : 'Supplier'} *
                </Label>
                {loadingTenants ? (
                  <div className="mt-1 text-sm text-gray-500">Loading...</div>
                ) : tenants.length === 0 ? (
                  <div className="mt-1 rounded-md bg-yellow-50 p-3">
                    <p className="text-sm text-yellow-800">
                      No active {registrationType === 'new_company_user' ? 'companies' : 'suppliers'} found.
                    </p>
                  </div>
                ) : (
                  <select
                    id="tenantId"
                    {...register('tenantId', { required: true })}
                    className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Select a {registrationType === 'new_company_user' ? 'company' : 'supplier'}...</option>
                    {tenants.map((tenant) => (
                      <option key={tenant.id} value={tenant.id}>
                        {tenant.name}
                      </option>
                    ))}
                  </select>
                )}
                {errors.tenantId && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.tenantId.message || 'Please select a company or supplier'}
                  </p>
                )}
              </div>
            )}

            {/* Common fields */}
            <div>
              <Label htmlFor="email">Email address *</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                {...register('email', { 
                  required: 'Email is required',
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: 'Invalid email address',
                  },
                })}
                className="mt-1"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="password">Password *</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                {...register('password', { 
                  required: 'Password is required',
                  minLength: {
                    value: 8,
                    message: 'Password must be at least 8 characters',
                  },
                })}
                className="mt-1"
              />
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.password.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First Name (Optional)</Label>
                <Input
                  id="firstName"
                  type="text"
                  {...register('firstName')}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="lastName">Last Name (Optional)</Label>
                <Input
                  id="lastName"
                  type="text"
                  {...register('lastName')}
                  className="mt-1"
                />
              </div>
            </div>

            {(registrationType === 'new_company' || registrationType === 'new_supplier') && (
              <div className="rounded-md bg-blue-50 p-3">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> You will automatically become the administrator of your{' '}
                  {registrationType === 'new_supplier' ? 'supplier' : 'company'} account once approved by a super administrator.
                </p>
              </div>
            )}

            {(registrationType === 'new_company_user' || registrationType === 'new_supplier_user') && (
              <div className="rounded-md bg-yellow-50 p-3">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> Your account will be pending approval by the{' '}
                  {registrationType === 'new_supplier_user' ? 'supplier' : 'company'} administrator.
                </p>
              </div>
            )}
          </div>

          <div>
            <Button type="submit" className="w-full" disabled={loading || loadingTenants}>
              {loading ? 'Creating account...' : 'Create account'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
