//On-Click function for returning to top
function returnToTop(e) {
  document.body.scrollTop = document.documentElement.scrollTop = 0;
}

/*
 * Adding click events to the mobile sidenav menu and menu close
 * Could not find the web standard javascript that gives this
 * functionality, so quick attempt to mimic it.  Still not perfect
 * clicking outside the sidenav does not close it */
var menuBtn = document.getElementsByClassName("menu-btn")[0]
menuBtn.addEventListener("click", function (e) {
  e.preventDefault()
  var mobileNav = document.getElementsByClassName("sidenav-mobile")[0]
  mobileNav.className += ' is-visible';
});
var closeBtn = document.getElementsByClassName("sliding-panel-close")[0]
closeBtn.addEventListener("click", function (e) {
  e.preventDefault()
  var mobileNav = document.getElementsByClassName("sidenav-mobile")[0]
  mobileNav.className = "sidenav-mobile"
})