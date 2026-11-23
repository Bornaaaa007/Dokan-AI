import RequireAuth from '../../components/RequireAuth';
import ShopTheLook from '../../components/ShopTheLook';

export default function Page() { return <RequireAuth><ShopTheLook /></RequireAuth>; }