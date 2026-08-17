import { useEffect, useRef } from "react";

export type LanguageCode = string;
export type ResolutionString = string;
export interface ChartingLibraryWidgetOptions {
  symbol?: string;
  datafeed?: any;
  interval?: string;
  container?: HTMLElement;
  library_path?: string;
  locale?: string;
  disabled_features?: string[];
  enabled_features?: string[];
  charts_storage_url?: string;
  charts_storage_api_version?: string;
  client_id?: string;
  user_id?: string;
  fullscreen?: boolean;
  autosize?: boolean;
  theme?: string;
  [key: string]: any;
}

export class widget {
  constructor(options: ChartingLibraryWidgetOptions) {}
  onChartReady(callback: () => void) {
    callback();
  }
  remove() {}
}

export interface TVChartContainerProps extends Partial<ChartingLibraryWidgetOptions> {}

export const TVChartContainer = (props: TVChartContainerProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const widgetOptions: ChartingLibraryWidgetOptions = {
      symbol: props.symbol || "AAPL",
      // BEWARE: no trailing slash is expected in feed URL
      datafeed: new (window as any).Datafeeds.UDFCompatibleDatafeed(
        "https://demo_feed.tradingview.com",
        undefined,
        {
          maxResponseLength: 1000,
          expectedOrder: "latestFirst",
        }
      ),
      interval: (props.interval as ResolutionString) || "1D",
      container: chartContainerRef.current,
      library_path: props.library_path || "/static/charting_library/",
      locale: (props.locale as LanguageCode) || "en",
      disabled_features: ["use_localstorage_for_settings"],
      enabled_features: ["study_templates"],
      charts_storage_url: props.charts_storage_url || "https://saveload.tradingview.com",
      charts_storage_api_version: props.charts_storage_api_version || "1.1",
      client_id: props.client_id || "tradingview.com",
      user_id: props.user_id || "public_user_id",
      fullscreen: props.fullscreen || false,
      autosize: props.autosize || true,
      theme: props.theme || "Dark",
      ...props,
    };

    const tvWidget = new widget(widgetOptions);

    tvWidget.onChartReady(() => {
      console.log("TradingView Chart Ready");
    });

    return () => {
      tvWidget.remove();
    };
  }, [props]);

  return <div ref={chartContainerRef} className="w-full h-full min-h-[400px]" />;
};
