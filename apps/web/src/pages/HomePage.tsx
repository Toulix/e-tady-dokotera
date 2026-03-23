import HeroSearch from '../components/landing/HeroSearch';
import SpecialtiesSection from '../components/landing/SpecialtiesSection';

export default function HomePage() {
  return (
    <div className="bg-surface min-h-screen">
      <HeroSearch />
      <SpecialtiesSection />
    </div>
  );
}
