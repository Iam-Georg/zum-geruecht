$(document).ready(function () {

    // ─── Scroll-to-Top Button ─────────────────────────────────────────────────
    $('#schalter_oben').hide();

    $(window).on('scroll', function () {
        if ($(this).scrollTop() > 450) {
            $('#schalter_oben').fadeIn(300);
        } else {
            $('#schalter_oben').fadeOut(300);
        }
    });

    $('#schalter_oben').on('click', function () {
        $('html, body').animate({
            scrollTop: 0
        }, 600);
        return false;
    });

    // ─── Externe Links in neuem Tab öffnen ───────────────────────────────────
    // Sicherer als target="_blank" per JS: rel="noopener noreferrer" wird mitgesetzt
    $('a[rel~="external"]').attr({
        target: '_blank',
        rel: 'external noopener noreferrer'
    });

    // ─── Lightbox (ekko) ─────────────────────────────────────────────────────
    $(document).on('click', '[data-toggle="lightbox"]', function (e) {
        e.preventDefault();
        $(this).ekkoLightbox();
    });

});