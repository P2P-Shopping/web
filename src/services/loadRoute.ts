import routeData from "../data/route-mock.json";
import { useStore } from "../context/useStore";

type RoutePoint = { name: string; x: number; y: number; itemId: string; lat: number; lng: number };
const typedRouteData = routeData as RoutePoint[];

export function loadMockRoute() {
  const { setRoute } = useStore.getState();
  console.log("Mock route loaded:", typedRouteData);
  setRoute(typedRouteData);
}
