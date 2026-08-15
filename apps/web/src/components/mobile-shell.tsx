'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, CloudUpload, CreditCard, LogOut, MapPin, Plus, RefreshCw, Search, ShoppingCart, Trash2, UserPlus, X } from 'lucide-react';
import { apiRequest, AuthResponse, Customer, DriverMobileRoute, DriverMobileStop, Invoice, Product } from '../lib/api';
import { LoginForm } from './login-form';

const storageKey = 'agua-distri-session';
const queueKey = 'agua-distri-mobile-sync-queue';

type QueuedOperation = {
  idempotencyKey: string;
  action: 'complete_stop' | 'fail_stop';
  routeOrderId: string;
  payload: Record<string, unknown>;
};

type MobileCatalog = {
  customers: Customer[];
  products: Product[];
};

type MobileItem = {
  productId: string;
  orderedQuantity: string;
  deliveredQuantity: string;
  unitPrice: string;
  source: 'ORDER_ITEM' | 'ADDITIONAL';
};

type NewSaleForm = {
  routeId: string;
  customerId: string;
  productId: string;
  quantity: string;
  unitPrice: string;
  notes: string;
};

type QuickCustomerForm = {
  name: string;
  phone: string;
  address: string;
};

type MobilePaymentForm = {
  customerId: string;
  amount: string;
  method: string;
  reference: string;
  notes: string;
};

type MobileDebt = {
  customer: Customer;
  balance: number;
  invoices: Invoice[];
};

type PaymentChoice = 'FULL' | 'PARTIAL' | 'NONE';

function readStoredSession(): AuthResponse | null {
  try {
    const stored = window.localStorage.getItem(storageKey);
    return stored ? (JSON.parse(stored) as AuthResponse) : null;
  } catch {
    return null;
  }
}

export function MobileShell() {
  const refreshPromiseRef = useRef<Promise<AuthResponse> | null>(null);
  const [session, setSession] = useState<AuthResponse | null>(null);
  const [routes, setRoutes] = useState<DriverMobileRoute[]>([]);
  const [catalog, setCatalog] = useState<MobileCatalog>({ customers: [], products: [] });
  const [selectedStop, setSelectedStop] = useState<DriverMobileStop | null>(null);
  const [items, setItems] = useState<MobileItem[]>([]);
  const [extraProductId, setExtraProductId] = useState('');
  const [extraQuantity, setExtraQuantity] = useState('1');
  const [extraPrice, setExtraPrice] = useState('');
  const [paymentChoice, setPaymentChoice] = useState<PaymentChoice>('FULL');
  const [collectedAmount, setCollectedAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [observations, setObservations] = useState('');
  const [failureReason, setFailureReason] = useState('Cliente ausente');
  const [newSale, setNewSale] = useState<NewSaleForm>({ routeId: '', customerId: '', productId: '', quantity: '1', unitPrice: '', notes: '' });
  const [quickCustomer, setQuickCustomer] = useState<QuickCustomerForm>({ name: '', phone: '', address: '' });
  const [mobilePayment, setMobilePayment] = useState<MobilePaymentForm>({ customerId: '', amount: '', method: 'TRANSFER', reference: '', notes: '' });
  const [customerSearch, setCustomerSearch] = useState('');
  const [paymentCustomerSearch, setPaymentCustomerSearch] = useState('');
  const [debt, setDebt] = useState<MobileDebt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [creatingSale, setCreatingSale] = useState(false);
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [creatingPayment, setCreatingPayment] = useState(false);
  const [queue, setQueue] = useState<QueuedOperation[]>([]);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    const storedSession = readStoredSession();
    const queued = window.localStorage.getItem(queueKey);
    if (storedSession) setSession(storedSession);
    if (queued) setQueue(JSON.parse(queued) as QueuedOperation[]);
  }, []);

  useEffect(() => {
    if (session) void loadMobileData(session);
  }, [session]);

  useEffect(() => {
    if (!session) return;

    function refreshWhenVisible() {
      if (document.visibilityState === 'visible') void loadMobileData();
    }

    document.addEventListener('visibilitychange', refreshWhenVisible);
    window.addEventListener('focus', refreshWhenVisible);
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadMobileData();
    }, 60_000);

    return () => {
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.removeEventListener('focus', refreshWhenVisible);
      window.clearInterval(interval);
    };
  }, [session]);

  const visibleCustomers = useMemo(() => {
    const term = customerSearch.trim().toLowerCase();
    if (!term) return catalog.customers.slice(0, 12);
    return catalog.customers
      .filter((customer) => customerName(customer).toLowerCase().includes(term) || customer.phone?.includes(term))
      .slice(0, 12);
  }, [catalog.customers, customerSearch]);

  const paymentCustomers = useMemo(() => {
    const term = paymentCustomerSearch.trim().toLowerCase();
    if (!term) return catalog.customers.slice(0, 8);
    return catalog.customers
      .filter((customer) => customerName(customer).toLowerCase().includes(term) || customer.phone?.includes(term))
      .slice(0, 8);
  }, [catalog.customers, paymentCustomerSearch]);

  const deliveryTotal = useMemo(() => items.reduce((total, item) => total + itemTotal(item), 0), [items]);

  useEffect(() => {
    if (!selectedStop) return;
    if (paymentChoice === 'FULL') setCollectedAmount(formatAmount(deliveryTotal));
    if (paymentChoice === 'NONE') setCollectedAmount('0');
  }, [deliveryTotal, paymentChoice, selectedStop]);

  function handleLogin(nextSession: AuthResponse) {
    window.localStorage.setItem(storageKey, JSON.stringify(nextSession));
    setError(null);
    setSession(nextSession);
  }

  function handleLogout() {
    window.localStorage.removeItem(storageKey);
    setSession(null);
    setRoutes([]);
    setSelectedStop(null);
  }

  function persistSession(nextSession: AuthResponse) {
    window.localStorage.setItem(storageKey, JSON.stringify(nextSession));
    setSession(nextSession);
    return nextSession;
  }

  async function refreshSession(activeSession = session): Promise<AuthResponse> {
    if (!activeSession) throw new Error('Sesion no disponible');
    if (!refreshPromiseRef.current) {
      refreshPromiseRef.current = apiRequest<AuthResponse>('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: activeSession.refreshToken })
      })
        .then(persistSession)
        .finally(() => {
          refreshPromiseRef.current = null;
        });
    }
    return refreshPromiseRef.current;
  }

  async function requestWithSession<T>(path: string, options: RequestInit = {}, activeSession = session): Promise<T> {
    if (!activeSession) throw new Error('Sesion no disponible');
    const requestOptions: RequestInit = { cache: 'no-store', ...options };
    try {
      return await apiRequest<T>(path, { ...requestOptions, token: activeSession.accessToken });
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : '';
      if (!isAuthError(message)) throw requestError;
      const storedSession = readStoredSession();
      if (storedSession && storedSession.refreshToken !== activeSession.refreshToken) {
        return apiRequest<T>(path, { ...requestOptions, token: storedSession.accessToken });
      }
      const nextSession = await refreshSession(activeSession);
      return apiRequest<T>(path, { ...requestOptions, token: nextSession.accessToken });
    }
  }

  function persistQueue(nextQueue: QueuedOperation[]) {
    setQueue(nextQueue);
    window.localStorage.setItem(queueKey, JSON.stringify(nextQueue));
  }

  async function loadMobileData(activeSession = session) {
    if (!activeSession) return;
    setLoading(true);
    setError(null);
    try {
      const [nextRoutes, nextCatalog] = await Promise.all([
        requestWithSession<DriverMobileRoute[]>('/driver-mobile/routes', {}, activeSession),
        requestWithSession<MobileCatalog>('/driver-mobile/catalog', {}, activeSession)
      ]);
      setRoutes(nextRoutes);
      setCatalog(nextCatalog);
      setNewSale((current) => ({ ...current, routeId: current.routeId || nextRoutes[0]?.id || '' }));
      setLastUpdatedAt(new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudieron cargar datos');
    } finally {
      setLoading(false);
    }
  }

  function openStop(stop: DriverMobileStop) {
    if (stop.stopStatus !== 'PENDING') {
      setError(`La parada #${stop.sequence} ya esta ${stop.stopStatus.toLowerCase()}`);
      return;
    }
    setError(null);
    setSelectedStop(stop);
    setItems(
      stop.order.items.map((item) => ({
        productId: item.product.id,
        orderedQuantity: item.quantity,
        deliveredQuantity: item.quantity,
        unitPrice: item.unitPrice,
        source: 'ORDER_ITEM'
      }))
    );
    setPaymentChoice('FULL');
    setCollectedAmount(stop.order.total);
    setPaymentMethod(stop.paymentMethod ?? 'CASH');
    setObservations('');
    setFailureReason('Cliente ausente');
    setExtraProductId('');
    setExtraQuantity('1');
    setExtraPrice('');
  }

  function addExtraItem() {
    if (!extraProductId || Number(extraQuantity) <= 0) return;
    setItems((current) => [
      ...current,
      {
        productId: extraProductId,
        orderedQuantity: '0',
        deliveredQuantity: extraQuantity,
        unitPrice: extraPrice || productPrice(extraProductId, selectedStop?.order.customer.id),
        source: 'ADDITIONAL'
      }
    ]);
    setExtraProductId('');
    setExtraQuantity('1');
    setExtraPrice('');
  }

  function updateItem(index: number, changes: Partial<MobileItem>) {
    setItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...changes } : item)));
  }

  function removeItem(index: number) {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function position() {
    if (!navigator.geolocation) return {};
    return new Promise<{ latitude?: number; longitude?: number; accuracy?: number }>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (value) => resolve({ latitude: value.coords.latitude, longitude: value.coords.longitude, accuracy: value.coords.accuracy }),
        () => resolve({}),
        { enableHighAccuracy: true, timeout: 5000 }
      );
    });
  }

  async function completeSelectedStop() {
    if (!selectedStop) return;
    if (selectedStop.stopStatus !== 'PENDING') {
      setError(`La parada #${selectedStop.sequence} ya esta ${selectedStop.stopStatus.toLowerCase()}`);
      setSelectedStop(null);
      return;
    }
    const resolvedCollectedAmount = paymentChoice === 'FULL' ? deliveryTotal : paymentChoice === 'NONE' ? 0 : Number(collectedAmount || 0);
    if (paymentChoice === 'PARTIAL' && (resolvedCollectedAmount <= 0 || resolvedCollectedAmount >= deliveryTotal)) {
      setError('Para pago parcial ingresa un importe mayor a 0 y menor al total');
      return;
    }
    const gps = await position();
    const payload = {
      idempotencyKey: idempotencyKey(),
      items: items.map((item) => ({
        productId: item.productId,
        deliveredQuantity: Number(item.deliveredQuantity),
        orderedQuantity: Number(item.orderedQuantity),
        unitPrice: Number(item.unitPrice),
        source: item.source
      })),
      collectedAmount: resolvedCollectedAmount,
      paymentMethod,
      observations: observations || 'Entregado desde movil',
      ...gps
    };
    await sendOrQueue({ idempotencyKey: payload.idempotencyKey, action: 'complete_stop', routeOrderId: selectedStop.id, payload }, `/driver-mobile/stops/${selectedStop.id}/complete`, payload);
    setSelectedStop(null);
  }

  async function failSelectedStop() {
    if (!selectedStop) return;
    if (selectedStop.stopStatus !== 'PENDING') {
      setError(`La parada #${selectedStop.sequence} ya esta ${selectedStop.stopStatus.toLowerCase()}`);
      setSelectedStop(null);
      return;
    }
    const gps = await position();
    const payload = {
      idempotencyKey: idempotencyKey(),
      reason: failureReason,
      observations: observations || 'Marcado desde movil',
      ...gps
    };
    await sendOrQueue({ idempotencyKey: payload.idempotencyKey, action: 'fail_stop', routeOrderId: selectedStop.id, payload }, `/driver-mobile/stops/${selectedStop.id}/fail`, payload);
    setSelectedStop(null);
  }

  async function createMobileSale() {
    if (!session) return;
    if (!newSale.customerId) {
      setError('Selecciona un cliente para la venta');
      return;
    }
    if (!newSale.productId) {
      setError('Selecciona un producto para la venta');
      return;
    }
    if (Number(newSale.quantity) <= 0) {
      setError('La cantidad debe ser mayor a cero');
      return;
    }
    setError(null);
    setCreatingSale(true);
    try {
      const path = newSale.routeId ? `/driver-mobile/routes/${newSale.routeId}/sales` : '/driver-mobile/quick-sales';
      await requestWithSession(path, {
        method: 'POST',
        body: JSON.stringify({
          customerId: newSale.customerId,
          notes: newSale.notes || 'Venta nueva en ruta',
          items: [
            {
              productId: newSale.productId,
              quantity: Number(newSale.quantity),
              unitPrice: newSale.unitPrice ? Number(newSale.unitPrice) : undefined
            }
          ]
        })
      });
      setNewSale({ routeId: newSale.routeId, customerId: '', productId: '', quantity: '1', unitPrice: '', notes: '' });
      setCustomerSearch('');
      setError(newSale.routeId ? 'Venta/parada creada' : 'Venta/parada creada en ruta automatica');
      void loadMobileData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo crear la venta');
    } finally {
      setCreatingSale(false);
    }
  }

  async function createQuickCustomer() {
    if (!session) return;
    if (!quickCustomer.name.trim()) {
      setError('Ingresa el nombre del cliente');
      return;
    }
    setError(null);
    setCreatingCustomer(true);
    try {
      const customer = await requestWithSession<Customer>('/driver-mobile/customers', {
        method: 'POST',
        body: JSON.stringify({
          name: quickCustomer.name,
          phone: quickCustomer.phone || undefined,
          address: quickCustomer.address || undefined
        })
      });
      setQuickCustomer({ name: '', phone: '', address: '' });
      setNewSale((current) => ({ ...current, customerId: customer.id }));
      setMobilePayment((current) => ({ ...current, customerId: customer.id }));
      setCustomerSearch(customerName(customer));
      setPaymentCustomerSearch(customerName(customer));
      setError('Cliente creado');
      await loadMobileData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo crear el cliente');
    } finally {
      setCreatingCustomer(false);
    }
  }

  async function loadCustomerDebt(customerId: string) {
    if (!session || !customerId) return;
    setError(null);
    try {
      const nextDebt = await requestWithSession<MobileDebt>(`/driver-mobile/customers/${customerId}/debt`);
      setDebt(nextDebt);
      setMobilePayment((current) => ({ ...current, customerId, amount: current.amount || (nextDebt.balance > 0 ? formatAmount(nextDebt.balance) : '') }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo consultar la deuda');
    }
  }

  async function createCustomerPayment() {
    if (!session) return;
    if (!mobilePayment.customerId) {
      setError('Selecciona un cliente para cobrar');
      return;
    }
    if (Number(mobilePayment.amount) <= 0) {
      setError('El importe debe ser mayor a cero');
      return;
    }
    setError(null);
    setCreatingPayment(true);
    try {
      await requestWithSession('/driver-mobile/payments', {
        method: 'POST',
        body: JSON.stringify({
          customerId: mobilePayment.customerId,
          amount: Number(mobilePayment.amount),
          method: mobilePayment.method,
          reference: mobilePayment.reference || undefined,
          notes: mobilePayment.notes || 'Pago registrado desde movil'
        })
      });
      setMobilePayment({ customerId: mobilePayment.customerId, amount: '', method: mobilePayment.method, reference: '', notes: '' });
      setError('Pago registrado y aplicado a deuda');
      await loadCustomerDebt(mobilePayment.customerId);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo registrar el pago');
    } finally {
      setCreatingPayment(false);
    }
  }

  async function sendOrQueue(operation: QueuedOperation, path: string, body: object) {
    if (!session) return;
    try {
      await requestWithSession(path, { method: 'POST', body: JSON.stringify(body) });
      await loadMobileData();
    } catch (requestError) {
      persistQueue([...queue, operation]);
      const message = requestError instanceof Error ? requestError.message : 'No se pudo enviar la operacion';
      if (isAuthError(message)) {
        expireSession('Sesion vencida. La operacion quedo guardada; ingresa de nuevo y toca Sincronizar.');
        return;
      }
      setError('Operacion guardada offline para sincronizar');
    }
  }

  async function syncQueue() {
    if (!session || !queue.length) return;
    setError(null);
    try {
      await requestWithSession('/driver-mobile/sync', {
        method: 'POST',
        body: JSON.stringify({ operations: queue })
      });
      persistQueue([]);
      await loadMobileData();
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'No se pudo sincronizar';
      if (isAuthError(message)) {
        expireSession('Sesion vencida. Ingresa de nuevo y toca Sincronizar para enviar lo pendiente.');
        return;
      }
      setError(`No se pudo sincronizar: ${message}`);
    }
  }

  function expireSession(message: string) {
    window.localStorage.removeItem(storageKey);
    setSession(null);
    setRoutes([]);
    setSelectedStop(null);
    setError(message);
  }

  function productName(productId: string): string {
    return catalog.products.find((product) => product.id === productId)?.name ?? productId;
  }

  function productPrice(productId: string, customerId = newSale.customerId): string {
    const customer = catalog.customers.find((current) => current.id === customerId);
    const product = catalog.products.find((current) => current.id === productId);
    return customerProductPrice(productId, customer, product);
  }

  function updateSaleCustomer(customer: Customer) {
    setNewSale((current) => ({
      ...current,
      customerId: customer.id,
      unitPrice: current.productId ? customerProductPrice(current.productId, customer, catalog.products.find((product) => product.id === current.productId)) : current.unitPrice
    }));
  }

  function itemTotal(item: MobileItem): number {
    return Number(item.deliveredQuantity || 0) * Number(item.unitPrice || 0);
  }

  function selectPaymentChoice(nextChoice: PaymentChoice) {
    setPaymentChoice(nextChoice);
    if (nextChoice === 'FULL') setCollectedAmount(formatAmount(deliveryTotal));
    if (nextChoice === 'NONE') setCollectedAmount('0');
    if (nextChoice === 'PARTIAL' && Number(collectedAmount || 0) >= deliveryTotal) setCollectedAmount('');
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-6">
        <section className="mx-auto grid max-w-md gap-4">
          <div>
            <p className="text-sm font-semibold uppercase text-primary">Movil repartidor</p>
            <h1 className="mt-1 text-2xl font-semibold">Jornada</h1>
          </div>
          {error ? <p className="border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{error}</p> : null}
          <LoginForm onLogin={handleLogin} />
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-3 py-4">
      <section className="mx-auto grid max-w-md gap-3">
        <header className="sticky top-0 z-10 -mx-3 border-b border-slate-200 bg-white px-3 py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-primary">Movil repartidor</p>
              <h1 className="text-xl font-semibold">{session.user.firstName}</h1>
            </div>
            <button onClick={handleLogout} className="grid h-10 w-10 place-items-center border border-border" title="Salir">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {error ? <p className="border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{error}</p> : null}

        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => void loadMobileData()} className="inline-flex h-11 items-center justify-center gap-2 border border-border bg-white text-sm font-semibold">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
          <button onClick={() => void syncQueue()} className="col-span-2 inline-flex h-11 items-center justify-center gap-2 bg-primary text-sm font-semibold text-white">
            <CloudUpload className="h-4 w-4" />
            Sincronizar {queue.length}
          </button>
        </div>
        <p className="-mt-1 text-right text-xs text-slate-500">
          {lastUpdatedAt ? `Actualizado ${lastUpdatedAt} · ` : ''}
          {catalog.customers.length} clientes · {catalog.products.length} productos
        </p>

        <section className="border border-border bg-white p-3">
          <div className="mb-3 flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Cliente rapido</h2>
          </div>
          <div className="grid gap-2">
            <input value={quickCustomer.name} onChange={(event) => setQuickCustomer({ ...quickCustomer, name: event.target.value })} className="h-11 border border-border px-3 text-sm" placeholder="Nombre o razon social" />
            <input value={quickCustomer.phone} onChange={(event) => setQuickCustomer({ ...quickCustomer, phone: event.target.value })} className="h-11 border border-border px-3 text-sm" placeholder="Telefono" />
            <input value={quickCustomer.address} onChange={(event) => setQuickCustomer({ ...quickCustomer, address: event.target.value })} className="h-11 border border-border px-3 text-sm" placeholder="Direccion" />
            <button
              type="button"
              onClick={() => void createQuickCustomer()}
              disabled={creatingCustomer}
              className="h-11 border border-primary text-sm font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creatingCustomer ? 'Creando...' : 'Crear cliente'}
            </button>
          </div>
        </section>

        <section className="border border-border bg-white p-3">
          <div className="mb-3 flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Cobrar deuda</h2>
          </div>
          <div className="grid gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input value={paymentCustomerSearch} onChange={(event) => setPaymentCustomerSearch(event.target.value)} placeholder="Buscar cliente" className="h-11 w-full border border-border pl-9 pr-3 text-sm" />
            </div>
            <div className="grid max-h-32 gap-1 overflow-auto">
              {paymentCustomers.map((customer) => (
                <button
                  key={customer.id}
                  type="button"
                  onClick={() => {
                    setMobilePayment({ ...mobilePayment, customerId: customer.id });
                    setPaymentCustomerSearch(customerName(customer));
                    void loadCustomerDebt(customer.id);
                  }}
                  className={`border px-3 py-2 text-left text-sm ${mobilePayment.customerId === customer.id ? 'border-primary bg-cyan-50' : 'border-border'}`}
                >
                  {customerName(customer)}
                </button>
              ))}
            </div>
            {debt && debt.customer.id === mobilePayment.customerId ? (
              <div className="grid gap-2 border border-border bg-slate-50 p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">Deuda actual</span>
                  <span className="font-semibold">{formatAmount(debt.balance)}</span>
                </div>
                {debt.invoices.length ? (
                  <div className="grid gap-1 text-xs text-slate-600">
                    {debt.invoices.map((invoice) => (
                      <div key={invoice.id} className="border-t border-border pt-1">
                        <p>{orderReference(invoice.order)} / {invoice.number}</p>
                        <p>total {invoice.total} · pagado {invoicePaidAmount(invoice)} · saldo {invoice.balance}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-600">Sin facturas pendientes</p>
                )}
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              <input value={mobilePayment.amount} onChange={(event) => setMobilePayment({ ...mobilePayment, amount: event.target.value })} type="number" className="h-11 border border-border px-3 text-sm" placeholder="Importe" />
              <select value={mobilePayment.method} onChange={(event) => setMobilePayment({ ...mobilePayment, method: event.target.value })} className="h-11 border border-border px-3 text-sm">
                <option value="TRANSFER">Transferencia</option>
                <option value="CASH">Efectivo</option>
                <option value="CARD">Tarjeta</option>
                <option value="OTHER">Otro</option>
              </select>
            </div>
            <input value={mobilePayment.reference} onChange={(event) => setMobilePayment({ ...mobilePayment, reference: event.target.value })} className="h-11 border border-border px-3 text-sm" placeholder="Referencia" />
            <button
              type="button"
              onClick={() => void createCustomerPayment()}
              disabled={creatingPayment}
              className="h-11 bg-primary text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creatingPayment ? 'Registrando...' : 'Registrar pago'}
            </button>
          </div>
        </section>

        <section className="border border-border bg-white p-3">
          <div className="mb-3 flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Venta nueva en ruta</h2>
          </div>
          <div className="grid gap-2">
            <select value={newSale.routeId} onChange={(event) => setNewSale({ ...newSale, routeId: event.target.value })} className="h-11 border border-border px-3 text-sm">
              <option value="">Ruta automatica del dia</option>
              {routes.map((route) => (
                <option key={route.id} value={route.id}>{route.name}</option>
              ))}
            </select>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder="Buscar cliente" className="h-11 w-full border border-border pl-9 pr-3 text-sm" />
            </div>
            <div className="grid max-h-36 gap-1 overflow-auto">
              {visibleCustomers.map((customer) => (
                <button
                  key={customer.id}
                  type="button"
                  onClick={() => updateSaleCustomer(customer)}
                  className={`border px-3 py-2 text-left text-sm ${newSale.customerId === customer.id ? 'border-primary bg-cyan-50' : 'border-border'}`}
                >
                  {customerName(customer)}
                </button>
              ))}
            </div>
            <select value={newSale.productId} onChange={(event) => setNewSale({ ...newSale, productId: event.target.value, unitPrice: productPrice(event.target.value) })} className="h-11 border border-border px-3 text-sm">
              <option value="">Producto</option>
              {catalog.products.map((product) => (
                <option key={product.id} value={product.id}>{product.name}</option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input value={newSale.quantity} onChange={(event) => setNewSale({ ...newSale, quantity: event.target.value })} type="number" className="h-11 border border-border px-3 text-sm" placeholder="Cantidad" />
              <input value={newSale.unitPrice} onChange={(event) => setNewSale({ ...newSale, unitPrice: event.target.value })} type="number" className="h-11 border border-border px-3 text-sm" placeholder="Precio" />
            </div>
            <button
              onClick={() => void createMobileSale()}
              disabled={creatingSale}
              className="h-11 bg-slate-900 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creatingSale ? 'Creando...' : 'Crear venta/parada'}
            </button>
          </div>
        </section>

        {routes.map((route) => (
          <section key={route.id} className="border border-border bg-white p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">{route.name}</h2>
                <p className="mt-1 text-sm text-slate-600">{route.vehicle.plate} · {route.status}</p>
              </div>
              <span className="text-sm font-semibold text-primary">{route.orders.length}</span>
            </div>
            <div className="mt-3 grid gap-2">
              {route.orders.map((stop) => (
                <article key={stop.id} className={`border p-3 ${stop.stopStatus === 'PENDING' ? 'border-border bg-white' : 'border-slate-200 bg-slate-50'}`}>
                  <button
                    type="button"
                    onClick={() => openStop(stop)}
                    disabled={stop.stopStatus !== 'PENDING'}
                    className={`w-full text-left ${stop.stopStatus !== 'PENDING' ? 'cursor-not-allowed opacity-75' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">#{stop.sequence} {customerName(stop.order.customer)}</p>
                        <p className="mt-1 text-sm text-slate-600">{stop.order.deliveryAddress?.street ?? stop.order.deliveryStreet ?? 'Venta en ruta'}</p>
                        <p className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500">
                          <MapPin className="h-3 w-3" />
                          {stop.stopStatus}
                        </p>
                      </div>
                      <p className="text-sm font-semibold">{stop.order.total}</p>
                    </div>
                  </button>
                </article>
              ))}
            </div>
          </section>
        ))}

        {selectedStop ? (
          <section className="fixed inset-0 z-30 overflow-y-auto overflow-x-hidden bg-slate-950/70 p-2 sm:p-3">
            <div className="mx-auto grid w-full max-w-md min-w-0 gap-3 bg-white p-3 sm:p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase text-primary">Parada #{selectedStop.sequence}</p>
                  <h2 className="break-words text-lg font-semibold">{customerName(selectedStop.order.customer)}</h2>
                  <p className="break-words text-sm text-slate-600">{selectedStop.order.deliveryAddress?.street ?? selectedStop.order.deliveryStreet ?? 'Sin direccion'}</p>
                </div>
                <button onClick={() => setSelectedStop(null)} className="grid h-9 w-9 shrink-0 place-items-center border border-border">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid gap-2">
                {items.map((item, index) => (
                  <div key={`${item.productId}-${index}`} className="min-w-0 border border-border p-3">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <p className="min-w-0 break-words text-sm font-semibold">{productName(item.productId)}</p>
                      <span className="shrink-0 text-xs text-slate-500">{item.source === 'ADDITIONAL' ? 'Extra' : 'Pedido'}</span>
                    </div>
                    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_40px] gap-2">
                      <input value={item.deliveredQuantity} onChange={(event) => updateItem(index, { deliveredQuantity: event.target.value })} type="number" className="h-10 min-w-0 border border-border px-2 text-sm" />
                      <input value={item.unitPrice} onChange={(event) => updateItem(index, { unitPrice: event.target.value })} type="number" className="h-10 min-w-0 border border-border px-2 text-sm" />
                      <button type="button" onClick={() => removeItem(index)} className="grid h-10 w-10 place-items-center border border-red-200 text-red-700">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="mt-2 text-right text-sm font-semibold">{itemTotal(item).toFixed(2)}</p>
                  </div>
                ))}
              </div>

              <div className="border border-border bg-slate-50 p-3">
                <p className="mb-2 text-sm font-semibold">Agregar producto extra</p>
                <div className="grid gap-2">
                  <select value={extraProductId} onChange={(event) => setExtraProductId(event.target.value)} className="h-10 min-w-0 border border-border px-2 text-sm">
                    <option value="">Producto</option>
                    {catalog.products.map((product) => (
                      <option key={product.id} value={product.id}>{product.name}</option>
                    ))}
                  </select>
                  <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_40px] gap-2">
                    <input value={extraQuantity} onChange={(event) => setExtraQuantity(event.target.value)} type="number" className="h-10 min-w-0 border border-border px-2 text-sm" placeholder="Cant." />
                    <input value={extraPrice} onChange={(event) => setExtraPrice(event.target.value)} type="number" className="h-10 min-w-0 border border-border px-2 text-sm" placeholder="Precio" />
                    <button type="button" onClick={addExtraItem} className="grid h-10 w-10 place-items-center bg-slate-900 text-white">
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid gap-2 border border-border bg-white p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold">Cobro del pedido</p>
                  <p className="text-sm font-semibold">{formatAmount(deliveryTotal)}</p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button type="button" onClick={() => selectPaymentChoice('FULL')} className={`h-10 border text-xs font-semibold ${paymentChoice === 'FULL' ? 'border-primary bg-cyan-50 text-primary' : 'border-border'}`}>
                    Total
                  </button>
                  <button type="button" onClick={() => selectPaymentChoice('PARTIAL')} className={`h-10 border text-xs font-semibold ${paymentChoice === 'PARTIAL' ? 'border-primary bg-cyan-50 text-primary' : 'border-border'}`}>
                    Parcial
                  </button>
                  <button type="button" onClick={() => selectPaymentChoice('NONE')} className={`h-10 border text-xs font-semibold ${paymentChoice === 'NONE' ? 'border-primary bg-cyan-50 text-primary' : 'border-border'}`}>
                    No pago
                  </button>
                </div>
                <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
                  <input
                    value={collectedAmount}
                    onChange={(event) => setCollectedAmount(event.target.value)}
                    type="number"
                    disabled={paymentChoice !== 'PARTIAL'}
                    className="h-11 min-w-0 border border-border px-3 text-sm disabled:bg-slate-100 disabled:text-slate-500"
                    placeholder="Importe cobrado"
                  />
                  <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} disabled={paymentChoice === 'NONE'} className="h-11 min-w-0 border border-border px-3 text-sm disabled:bg-slate-100 disabled:text-slate-500">
                    <option value="CASH">Efectivo</option>
                    <option value="TRANSFER">Transferencia</option>
                    <option value="CARD">Tarjeta</option>
                    <option value="OTHER">Otro</option>
                  </select>
                </div>
                <p className="text-xs text-slate-600">
                  {paymentChoice === 'FULL' ? 'Queda registrado como cobrado completo.' : paymentChoice === 'PARTIAL' ? `Quedara pendiente ${formatAmount(Math.max(deliveryTotal - Number(collectedAmount || 0), 0))}.` : `Quedara pendiente ${formatAmount(deliveryTotal)}.`}
                </p>
              </div>
              <select value={failureReason} onChange={(event) => setFailureReason(event.target.value)} className="h-11 min-w-0 border border-border px-3 text-sm">
                <option value="Cliente ausente">Cliente ausente</option>
                <option value="Local cerrado">Local cerrado</option>
                <option value="Direccion incorrecta">Direccion incorrecta</option>
                <option value="Rechazo el pedido">Rechazo el pedido</option>
                <option value="Sin dinero">Sin dinero</option>
                <option value="Otro">Otro</option>
              </select>
              <textarea value={observations} onChange={(event) => setObservations(event.target.value)} rows={3} className="min-w-0 border border-border px-3 py-2 text-sm" placeholder="Observaciones" />

              <div className="grid min-w-0 grid-cols-2 gap-2">
                <button onClick={() => void completeSelectedStop()} className="inline-flex h-11 items-center justify-center gap-2 bg-primary text-sm font-semibold text-white">
                  <Check className="h-4 w-4" />
                  Entregar
                </button>
                <button onClick={() => void failSelectedStop()} className="inline-flex h-11 items-center justify-center gap-2 border border-border text-sm font-semibold">
                  <X className="h-4 w-4" />
                  Fallida
                </button>
              </div>
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}

function customerName(customer: Customer): string;
function customerName(stopCustomer: Customer): string {
  return stopCustomer.businessName ?? (`${stopCustomer.firstName ?? ''} ${stopCustomer.lastName ?? ''}`.trim() || 'Sin nombre');
}

function orderReference(order?: { id: string } | null): string {
  return order ? `Pedido #${order.id.slice(-8)}` : 'Sin pedido';
}

function invoicePaidAmount(invoice: Invoice): string {
  return formatAmount(Number(invoice.total) - Number(invoice.balance));
}

function customerProductPrice(productId: string, customer?: Customer, product?: Product): string {
  const customerPrice = customer?.customerProductPrices?.find((item) => item.productId === productId)?.price;
  if (customerPrice) return customerPrice;

  const listPrice = customer?.priceList?.items.find((item) => item.productId === productId)?.price;
  if (listPrice) return listPrice;

  return product?.price ?? '0';
}

function idempotencyKey(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();

  if (cryptoApi?.getRandomValues) {
    const bytes = new Uint8Array(16);
    cryptoApi.getRandomValues(bytes);
    bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
    bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'));
    return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

function isAuthError(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes('invalid token') || normalized.includes('unauthorized') || normalized.includes('jwt');
}

function formatAmount(value: number): string {
  return value.toFixed(2).replace(/\.00$/, '');
}
