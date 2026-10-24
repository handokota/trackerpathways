import {
  AlertTriangle,
  ArrowDown,
  ArrowDownLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  ArrowUpDown,
  Award,
  BookOpen,
  Bookmark,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock3,
  Compass,
  LibraryBig,
  ListOrdered,
  LoaderCircle,
  Map,
  Monitor,
  Moon,
  Route,
  Search,
  SearchX,
  SlidersHorizontal,
  Sun,
  X,
  type LucideIcon,
} from "lucide-react";
import type { LucideProps } from "lucide-react";

export type IconName =
  | "arrow_downward"
  | "arrow_right_alt"
  | "arrow_upward"
  | "bookmarks"
  | "check_circle"
  | "chevron_left"
  | "chevron_right"
  | "close"
  | "collections_bookmark"
  | "directions"
  | "desktop_windows"
  | "dark_mode"
  | "error"
  | "expand_more"
  | "first_page"
  | "format_list_numbered"
  | "keyboard_arrow_down"
  | "last_page"
  | "linear_scale"
  | "light_mode"
  | "map"
  | "menu_book"
  | "outbound"
  | "progress_activity"
  | "route"
  | "schedule"
  | "search"
  | "search_off"
  | "south_west"
  | "sort"
  | "tune"
  | "workspace_premium";

interface IconProps extends LucideProps {
  name: IconName;
}

const icons: Record<IconName, LucideIcon> = {
  arrow_downward: ArrowDown,
  arrow_right_alt: ArrowRight,
  arrow_upward: ArrowUp,
  bookmarks: Bookmark,
  check_circle: CheckCircle,
  chevron_left: ChevronLeft,
  chevron_right: ChevronRight,
  close: X,
  collections_bookmark: LibraryBig,
  directions: Compass,
  desktop_windows: Monitor,
  dark_mode: Moon,
  error: AlertTriangle,
  expand_more: ChevronDown,
  first_page: ChevronsLeft,
  format_list_numbered: ListOrdered,
  keyboard_arrow_down: ChevronDown,
  last_page: ChevronsRight,
  linear_scale: ArrowUpDown,
  light_mode: Sun,
  map: Map,
  menu_book: BookOpen,
  outbound: ArrowUpRight,
  progress_activity: LoaderCircle,
  route: Route,
  schedule: Clock3,
  search: Search,
  search_off: SearchX,
  south_west: ArrowDownLeft,
  sort: ArrowUpDown,
  tune: SlidersHorizontal,
  workspace_premium: Award,
};

export default function Icon({ name, ...props }: IconProps) {
  const IconComponent = icons[name];
  return <IconComponent aria-hidden="true" size="1em" {...props} />;
}
