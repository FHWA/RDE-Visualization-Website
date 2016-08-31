//On-Click function for returning to top
function returnToTop(e) {
  document.body.scrollTop = document.documentElement.scrollTop = 0;
}

/*
 * Adding click events to the mobile sidenav menu and menu close
 * Could not find the web standard javascript that gives this
 * functionality, so quick attempt to mimic it.  Still not perfect
 * clicking outside the sidenav does not close it */

//Add event for menu button
var menuBtn = document.getElementsByClassName("menu-btn")[0]
menuBtn.addEventListener("click", function (e) {
  e.preventDefault();
  e.stopPropagation();

  //Toggle aside class
  var mobileNav = document.getElementsByClassName("sidenav-mobile")[0];
  mobileNav.className += ' is-visible';

  //Add event to document to check if click outside of sidenav (if so then close)
  document.onclick = function (e) {
    var mobileNav = document.getElementsByClassName("sidenav-mobile")[0];

    if (e.target.nodeName !== 'NAV' && e.target.nodeName !== 'ASIDE') {
      mobileNav.className = "sidenav-mobile";
      document.onclick = null;      
    }
  }
});

//Add event to close button, also remove the document event since side nav is now closed
var closeBtn = document.getElementsByClassName("sliding-panel-close")[0];
closeBtn.addEventListener("click", function (e) {
  e.preventDefault();
  e.stopPropagation();
  var mobileNav = document.getElementsByClassName("sidenav-mobile")[0];
  mobileNav.className = "sidenav-mobile";
  document.onclick = null;
})
