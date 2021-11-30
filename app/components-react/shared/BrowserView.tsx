import React, { useState, useRef, useEffect, useMemo } from 'react';
import electron from 'electron';
import path from 'path';
import cloneDeep from 'lodash/cloneDeep';
import { Spinner } from 'streamlabs-beaker';
import { I18nService } from 'services/i18n';
import Utils from 'services/utils';
import { Services } from 'components-react/service-provider';
import { useVuex } from 'components-react/hooks';

interface BrowserViewProps {
  src: string;
  hidden?: boolean;
  options?: Electron.BrowserViewConstructorOptions;
  setLocale?: boolean;
  enableGuestApi?: boolean;
  onReady?: (view: any) => void;
}

export default function BrowserView(p: BrowserViewProps) {
  const { WindowsService, AppService, CustomizationService } = Services;

  const [loading, setLoading] = useState(true);
  const sizeContainer = useRef<HTMLDivElement>(null);

  const { hideStyleBlockers, theme } = useVuex(() => ({
    hideStyleBlockers: WindowsService.state[Utils.getWindowId()].hideStyleBlockers,
    theme: CustomizationService.state.theme,
  }));

  const [currentPosition, setCurrentPosition] = useState<IVec2>();
  const [currentSize, setCurrentSize] = useState<IVec2>();

  const options = useMemo(() => {
    const opts = p.options ? cloneDeep(p.options) : { webPreferences: {} };
    // Enforce node integration disabled to prevent security issues
    if (!opts.webPreferences) opts.webPreferences = {};
    opts.webPreferences.nodeIntegration = false;

    if (p.enableGuestApi) {
      opts.webPreferences.enableRemoteModule = true;
      opts.webPreferences.contextIsolation = true;
      opts.webPreferences.preload = path.resolve(
        electron.remote.app.getAppPath(),
        'bundles',
        'guest-api',
      );
    }
    return opts;
  }, [p.options]);

  const browserView = useRef<Electron.BrowserView | null>(new electron.remote.BrowserView(options));

  useEffect(() => {
    if (browserView.current) {
      p.onReady && p.onReady(browserView.current);

      if (p.setLocale) I18nService.setBrowserViewLocale(browserView.current);

      browserView.current.webContents.on('did-finish-load', () => setLoading(false));
      electron.remote.getCurrentWindow().addBrowserView(browserView.current);
    }
    const resizeInterval = window.setInterval(checkResize, 100);
    const shutdownSubscription = AppService.shutdownStarted.subscribe(destroyBrowserView);

    return () => {
      destroyBrowserView();
      clearInterval(resizeInterval);
      shutdownSubscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    loadUrl();
  }, [theme]);

  function destroyBrowserView() {
    if (browserView.current) {
      electron.remote.getCurrentWindow().removeBrowserView(browserView.current);
      // See: https://github.com/electron/electron/issues/26929
      // @ts-ignore
      browserView.current.webContents.destroy();
      browserView.current = null;
    }
  }

  function checkResize() {
    if (loading) return;
    if (!sizeContainer.current) return;

    const rect: { left: number; top: number; width: number; height: number } =
      p.hidden || hideStyleBlockers
        ? { left: 0, top: 0, width: 0, height: 0 }
        : sizeContainer.current.getBoundingClientRect();

    if (currentPosition == null || currentSize == null || rectChanged(rect)) {
      setCurrentPosition({ x: rect.left, y: rect.top });
      setCurrentSize({ x: rect.width, y: rect.height });

      if (currentPosition && currentSize && browserView.current) {
        browserView.current.setBounds({
          x: Math.round(currentPosition.x),
          y: Math.round(currentPosition.y),
          width: Math.round(currentSize.x),
          height: Math.round(currentSize.y),
        });
      }
    }
  }

  async function loadUrl() {
    if (!browserView.current) return;
    try {
      await browserView.current.webContents.loadURL(p.src);
    } catch (e: unknown) {
      // ignore some common errors
      // that happen when the window has been closed before BrowserView accomplished the request
      if (e && typeof e === 'object') {
        if (e['code'] === 'ERR_ABORTED') return;
        if (e['message'] && e['message'].match(/\(\-3\) loading/)) return;
      }
      throw e;
    }
  }

  function rectChanged(rect: { left: number; top: number; width: number; height: number }) {
    if (!currentSize || !currentPosition) return false;
    return (
      rect.left !== currentPosition.x ||
      rect.top !== currentPosition.y ||
      rect.width !== currentSize.x ||
      rect.height !== currentSize.y
    );
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spinner size="large" />
      </div>
    );
  }

  return <div ref={sizeContainer} />;
}
