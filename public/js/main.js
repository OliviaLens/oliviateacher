/* Olivia Lenssens – Ballet Teacher | main.js */

document.addEventListener('DOMContentLoaded', () => {

    /* ── Navbar scroll behaviour ── */
    const navbar = document.getElementById('navbar');
    const onScroll = () => {
        if (window.scrollY > 60) navbar.classList.add('scrolled');
        else navbar.classList.remove('scrolled');
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    /* ── Mobile nav toggle ── */
    const toggle = document.getElementById('navToggle');
    const navLinks = document.getElementById('navLinks');
    const navCta = document.getElementById('navCta');

    if (toggle) {
        toggle.addEventListener('click', () => {
            const open = navLinks.classList.toggle('open');
            toggle.classList.toggle('open', open);
            toggle.setAttribute('aria-expanded', String(open));
        });

        // Close on link click
        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('open');
                toggle.classList.remove('open');
                toggle.setAttribute('aria-expanded', 'false');
            });
        });
    }

    /* ── Smooth anchor scroll ── */
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', (e) => {
            const target = document.querySelector(anchor.getAttribute('href'));
            if (target) {
                e.preventDefault();
                const offset = 70;
                const top = target.getBoundingClientRect().top + window.scrollY - offset;
                window.scrollTo({ top, behavior: 'smooth' });
            }
        });
    });

    /* ── Scroll-reveal animation ── */
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    document.querySelectorAll('.reveal, .reveal-stagger').forEach(el => observer.observe(el));

    /* ── Lightbox ── */
    const lightboxOverlay = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightboxImg');
    const lightboxClose = document.getElementById('lightboxClose');

    document.querySelectorAll('[data-lightbox]').forEach(item => {
        item.addEventListener('click', () => {
            const src = item.getAttribute('data-lightbox');
            lightboxImg.src = src;
            lightboxOverlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        });
    });

    const closeLightbox = () => {
        lightboxOverlay.classList.remove('active');
        lightboxImg.src = '';
        document.body.style.overflow = '';
    };

    if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
    if (lightboxOverlay) {
        lightboxOverlay.addEventListener('click', (e) => {
            if (e.target === lightboxOverlay) closeLightbox();
        });
    }

    /* ── Carousel ── */
    const carouselModal = document.getElementById('carouselModal');
    const carouselImg = document.getElementById('carouselImg');
    const carouselVideo = document.getElementById('carouselVideo');
    const carouselClose = document.getElementById('carouselClose');

    function isVideo(src) {
        return /\.(mp4|mov|webm|ogg)$/i.test(src);
    }
    const carouselPrev = document.getElementById('carouselPrev');
    const carouselNext = document.getElementById('carouselNext');
    const carouselCounter = document.getElementById('carouselCounter');
    const carouselTitleEl = document.getElementById('carouselTitle');
    const carouselDots = document.getElementById('carouselDots');

    let carouselImages = [];
    let carouselIndex = 0;

    function buildDots() {
        if (!carouselDots) return;
        carouselDots.innerHTML = '';
        carouselImages.forEach((src, i) => {
            const dot = document.createElement('button');
            dot.className = 'carousel-dot' + (i === carouselIndex ? ' active' : '');
            if (isVideo(src)) dot.classList.add('carousel-dot--video');
            dot.setAttribute('aria-label', `${isVideo(src) ? 'Video' : 'Photo'} ${i + 1} of ${carouselImages.length}`);
            dot.addEventListener('click', () => goToCarousel(i));
            carouselDots.appendChild(dot);
        });
    }

    function showCarouselSlide(index) {
        const src = carouselImages[index];
        const video = isVideo(src);

        // Pause any playing video before switching
        if (carouselVideo && !video) carouselVideo.pause();

        if (carouselImg) carouselImg.classList.add('fade');
        if (carouselVideo) carouselVideo.classList.add('fade');

        setTimeout(() => {
            if (video) {
                if (carouselImg) { carouselImg.style.display = 'none'; carouselImg.src = ''; }
                if (carouselVideo) {
                    carouselVideo.style.display = 'block';
                    carouselVideo.src = src;
                    carouselVideo.classList.remove('fade');
                }
            } else {
                if (carouselVideo) { carouselVideo.style.display = 'none'; carouselVideo.src = ''; }
                if (carouselImg) {
                    carouselImg.style.display = 'block';
                    carouselImg.src = src;
                    const markLoaded = () => carouselImg.classList.remove('fade');
                    carouselImg.addEventListener('load', markLoaded, { once: true });
                    if (carouselImg.complete && carouselImg.naturalWidth > 0) carouselImg.classList.remove('fade');
                }
            }
        }, 220);

        if (carouselCounter) carouselCounter.textContent = `${index + 1} / ${carouselImages.length}`;
        if (carouselDots) {
            carouselDots.querySelectorAll('.carousel-dot').forEach((d, i) => d.classList.toggle('active', i === index));
        }
        const showNav = carouselImages.length > 1;
        if (carouselPrev) carouselPrev.style.visibility = showNav ? 'visible' : 'hidden';
        if (carouselNext) carouselNext.style.visibility = showNav ? 'visible' : 'hidden';
    }

    function openCarousel(images, title, startIndex) {
        carouselImages = images;
        carouselIndex = typeof startIndex === 'number' ? startIndex : 0;
        if (carouselTitleEl) carouselTitleEl.textContent = title;
        buildDots();
        showCarouselSlide(carouselIndex);
        if (carouselModal) carouselModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeCarousel() {
        if (!carouselModal) return;
        carouselModal.classList.remove('active');
        if (carouselVideo) carouselVideo.pause();
        setTimeout(() => {
            if (carouselImg) carouselImg.src = '';
            if (carouselVideo) { carouselVideo.src = ''; carouselVideo.style.display = 'none'; }
            if (carouselImg) carouselImg.style.display = 'block';
        }, 350);
        document.body.style.overflow = '';
    }

    function goToCarousel(index) {
        carouselIndex = ((index % carouselImages.length) + carouselImages.length) % carouselImages.length;
        showCarouselSlide(carouselIndex);
    }

    if (carouselClose) carouselClose.addEventListener('click', closeCarousel);
    if (carouselModal) {
        carouselModal.addEventListener('click', (e) => { if (e.target === carouselModal) closeCarousel(); });
    }
    if (carouselPrev) carouselPrev.addEventListener('click', () => goToCarousel(carouselIndex - 1));
    if (carouselNext) carouselNext.addEventListener('click', () => goToCarousel(carouselIndex + 1));

    // Touch/swipe
    let touchStartX = 0;
    if (carouselModal) {
        carouselModal.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; }, { passive: true });
        carouselModal.addEventListener('touchend', (e) => {
            const dx = e.changedTouches[0].clientX - touchStartX;
            if (Math.abs(dx) > 50) goToCarousel(carouselIndex + (dx < 0 ? 1 : -1));
        });
    }

    // Wire carousel gallery cards – load media lists dynamically from the server
    const VIDEO_EXT_RE = /\.(mp4|mov|webm|ogg)$/i;

    function formatCount(files) {
        const photos = files.filter(f => !VIDEO_EXT_RE.test(f)).length;
        const videos = files.filter(f => VIDEO_EXT_RE.test(f)).length;
        const parts = [];
        if (photos) parts.push(`${photos} photo${photos !== 1 ? 's' : ''}`);
        if (videos) parts.push(`${videos} video${videos !== 1 ? 's' : ''}`);
        return parts.join(' · ');
    }

    document.querySelectorAll('[data-media-folder]').forEach(async (item) => {
        const folder = item.getAttribute('data-media-folder');
        const title = item.getAttribute('data-carousel-title') || '';

        let files = [];
        try {
            const resp = await fetch(`/api/media/${encodeURIComponent(folder)}`);
            const data = await resp.json();
            files = data.files || [];
        } catch (err) {
            console.error(`Failed to load media for "${folder}":`, err);
        }

        // Update the count badge in the overlay
        const countEl = item.querySelector(`[data-count-target="${folder}"]`);
        if (countEl) countEl.textContent = formatCount(files);

        // Update accessible label with real counts
        if (files.length) {
            item.setAttribute('aria-label', `${title} – ${formatCount(files)}, click to browse`);
        }

        item.addEventListener('click', () => {
            if (files.length) openCarousel(files, title, 0);
        });
        item.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); item.click(); }
        });
    });

    // Combined keyboard handler (lightbox + carousel)
    document.addEventListener('keydown', (e) => {
        const cActive = carouselModal && carouselModal.classList.contains('active');
        const lActive = lightboxOverlay && lightboxOverlay.classList.contains('active');
        if (e.key === 'Escape') {
            if (cActive) closeCarousel();
            else if (lActive) closeLightbox();
        }
        if (cActive) {
            if (e.key === 'ArrowRight') { e.preventDefault(); goToCarousel(carouselIndex + 1); }
            if (e.key === 'ArrowLeft') { e.preventDefault(); goToCarousel(carouselIndex - 1); }
        }
    });

    /* ── Contact form submission ── */
    const form = document.getElementById('contactForm');
    const statusEl = document.getElementById('formStatus');

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const submitBtn = form.querySelector('[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Sending…';
            statusEl.style.display = 'none';
            statusEl.className = 'form-status';

            const data = Object.fromEntries(new FormData(form));

            try {
                const resp = await fetch('/api/contact', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                });

                const result = await resp.json();

                if (result.success) {
                    statusEl.textContent = 'Thank you! Your message has been received. Olivia will be in touch shortly.';
                    statusEl.className = 'form-status success';
                    form.reset();
                } else {
                    throw new Error(result.error || 'Unknown error');
                }
            } catch (err) {
                statusEl.textContent = `Something went wrong. Please email directly: Olivia.Lenssens@gmail.com`;
                statusEl.className = 'form-status error';
                console.error(err);
            } finally {
                statusEl.style.display = 'block';
                submitBtn.disabled = false;
                submitBtn.textContent = 'Send Message';
            }
        });
    }

    /* ── Animated counters ── */
    let countersStarted = false;
    const statNumbers = document.querySelectorAll('.stat-number[data-target]');

    function animateCounters() {
        if (countersStarted) return;
        countersStarted = true;
        statNumbers.forEach(el => {
            const target = parseInt(el.dataset.target, 10);
            const prefix = el.dataset.prefix || '';
            const suffix = el.dataset.suffix || '';
            const duration = 1800;
            const start = performance.now();

            const step = (now) => {
                const elapsed = now - start;
                const progress = Math.min(elapsed / duration, 1);
                // Ease out quad
                const eased = 1 - (1 - progress) ** 2;
                const value = Math.floor(eased * target);
                el.textContent = prefix + value + suffix;
                if (progress < 1) requestAnimationFrame(step);
                else el.textContent = prefix + target + suffix;
            };
            requestAnimationFrame(step);
        });
    }

    const statsSection = document.querySelector('.intro-strip');
    if (statsSection) {
        const statsObserver = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                animateCounters();
                statsObserver.disconnect();
            }
        }, { threshold: 0.3 });
        statsObserver.observe(statsSection);
    }
});
