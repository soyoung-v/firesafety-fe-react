import { ROUTE_PATHS } from '@/shared/constants/routePaths'
import { AccountIcon, EquipmentIcon, HomeIcon, InspectionIcon } from './mobileNavIconComponents'

export const MOBILE_NAV_ICONS = {
  [ROUTE_PATHS.mobileEquipmentList]: EquipmentIcon,
  [ROUTE_PATHS.mobileInspection]: InspectionIcon,
  [ROUTE_PATHS.mobileDashboard]: HomeIcon,
  [ROUTE_PATHS.mobileAccountsContacts]: AccountIcon,
}
