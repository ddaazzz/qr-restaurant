import { useState, useCallback, useEffect } from 'react';
import { apiClient } from '../services/apiClient';
import { BluetoothPrinter } from '../types';
import { bluetoothService } from '../services/bluetoothService';
import { storageService } from '../services/storageService';

export const useMenu = (restaurantId: string) => {
  const [menu, setMenu] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMenu = useCallback(async () => {
    setLoading(true);
    try {
      // Try to get from cache first
      const cached = await storageService.getCachedMenu(restaurantId);
      if (cached) {
        setMenu(cached);
        return;
      }

      const data = await apiClient.getMenu();
      setMenu(data);
      await storageService.cacheMenu(restaurantId, data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load menu');
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    loadMenu();
  }, [restaurantId]);

  return { menu, loading, error, refetch: loadMenu };
};

export const useOrders = (sessionId: string) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.getOrders(sessionId);
      setOrders(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    loadOrders();
    // Poll for order updates every 5 seconds
    const interval = setInterval(loadOrders, 5000);
    return () => clearInterval(interval);
  }, [sessionId]);

  return { orders, loading, error, refetch: loadOrders };
};

export const usePrinters = () => {
  const [printers, setPrinters] = useState<BluetoothPrinter[]>([]);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scanForPrinters = useCallback(async () => {
    setScanning(true);
    try {
      const found = await bluetoothService.scanForPrinters();
      setPrinters(found);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to scan for printers');
    } finally {
      setScanning(false);
    }
  }, []);

  const connectPrinter = useCallback(
    async (printerId: string, location: string) => {
      try {
        await bluetoothService.connectToPrinter(printerId);
        const printer = printers.find((p) => p.id === printerId);
        if (printer) {
          await storageService.savePrinter({
            ...printer,
            location: location as any,
            deviceId: printerId,
            paperWidth: 80,
            temperatureSetting: 200,
          });
        }
        setError(null);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to connect to printer');
        return false;
      }
    },
    [printers]
  );

  const disconnectPrinter = useCallback(async (printerId: string) => {
    try {
      await bluetoothService.disconnectPrinter(printerId);
      await storageService.deletePrinter(printerId);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect printer');
    }
  }, []);

  const loadSavedPrinters = useCallback(async () => {
    try {
      const saved = await storageService.getPrinters();
      setPrinters(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load saved printers');
    }
  }, []);

  useEffect(() => {
    loadSavedPrinters();
  }, []);

  return {
    printers,
    scanning,
    error,
    scanForPrinters,
    connectPrinter,
    disconnectPrinter,
    loadSavedPrinters,
  };
};

export const useTables = (restaurantId: string) => {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTables = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.getTables();
      setTables(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tables');
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    loadTables();
  }, [restaurantId]);

  return { tables, loading, error, refetch: loadTables };
};
