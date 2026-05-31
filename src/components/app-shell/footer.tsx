export function AppFooter() {
  return (
    <footer className="hidden border-t border-slate-100/80 bg-white/80 px-4 py-3 text-xs text-slate-500 backdrop-blur-xl sm:px-6 lg:fixed lg:inset-x-0 lg:bottom-0 lg:z-40 lg:block">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        <span>Smart Financial OS v1.0</span>
        <div className="flex items-center gap-4">
          <a href="#" className="hover:text-slate-700">
            الدعم
          </a>
          <a href="#" className="hover:text-slate-700">
            الشروط
          </a>
          <a href="#" className="hover:text-slate-700">
            الخصوصية
          </a>
        </div>
      </div>
    </footer>
  );
}
