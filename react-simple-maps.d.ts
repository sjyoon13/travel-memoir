declare module "react-simple-maps" {
  import { ReactNode, MouseEventHandler, SVGProps } from "react";

  interface ComposableMapProps {
    projectionConfig?: {
      scale?: number;
      center?: [number, number];
      rotate?: [number, number, number];
    };
    width?: number;
    height?: number;
    className?: string;
    style?: React.CSSProperties;
    children?: ReactNode;
  }

  interface ZoomableGroupProps {
    zoom?: number;
    minZoom?: number;
    maxZoom?: number;
    center?: [number, number];
    children?: ReactNode;
  }

  interface Geo {
    rsmKey: string;
    id: string | number;
    properties: Record<string, unknown>;
  }

  interface GeographiesProps {
    geography: string | object;
    children: (props: { geographies: Geo[] }) => ReactNode;
  }

  interface GeographyStyle {
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    outline?: string;
    opacity?: number;
    cursor?: string;
  }

  interface GeographyProps extends SVGProps<SVGPathElement> {
    geography: Geo;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    style?: {
      default?: GeographyStyle;
      hover?: GeographyStyle;
      pressed?: GeographyStyle;
    };
    onMouseEnter?: (event: React.MouseEvent<SVGPathElement>) => void;
    onMouseLeave?: (event: React.MouseEvent<SVGPathElement>) => void;
    onClick?: (event: React.MouseEvent<SVGPathElement>) => void;
  }

  interface MarkerProps {
    coordinates: [number, number];
    children?: ReactNode;
  }

  export function ComposableMap(props: ComposableMapProps): JSX.Element;
  export function ZoomableGroup(props: ZoomableGroupProps): JSX.Element;
  export function Geographies(props: GeographiesProps): JSX.Element;
  export function Geography(props: GeographyProps): JSX.Element;
  export function Marker(props: MarkerProps): JSX.Element;
}
