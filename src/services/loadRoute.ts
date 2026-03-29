import routeData from "../data/route-mock.json";
import { useStore, type RoutePoint } from "../context/useStore";

const typedRouteData: RoutePoint[] = routeData;

export function loadMockRoute() {
  const { setRoute } = useStore.getState();
  console.log("Mock route loaded:", typedRouteData);
  setRoute(typedRouteData);
}
